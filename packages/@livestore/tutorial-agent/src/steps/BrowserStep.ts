import { chromium, webkit, firefox } from 'playwright'
import type { Browser, Page } from 'playwright'
import path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import type { Step, StepContext, StepResult } from '../core/Step.ts'
import type { TutorialAgentConfig, BrowserAction } from '../index.ts'

export class BrowserStep implements Step {
  public readonly name: string
  private readonly config: TutorialAgentConfig

  constructor(name: string, config: TutorialAgentConfig) {
    this.name = name
    this.config = config
  }

  async run(ctx: StepContext): Promise<StepResult> {
    const browsersToRun = this.config.browsers
    const launchers: Record<string, () => Promise<Browser>> = {
      chromium: () => chromium.launch(),
      webkit: () => webkit.launch(),
      firefox: () => firefox.launch(),
    }

    const artifacts = path.join(ctx.artifactsDir, 'browser')
    if (!existsSync(artifacts)) mkdirSync(artifacts, { recursive: true })

    try {
      await Promise.all(
        browsersToRun.map(async (name) => {
          const browser = await launchers[name]!()
          const context = await browser.newContext()
          await context.tracing.start({ screenshots: true, snapshots: true })
          const page = await context.newPage()
          try {
            await this.runAssertions(page, name, ctx)
          } finally {
            const traceFile = path.join(artifacts, `${name}-trace.zip`)
            await context.tracing.stop({ path: traceFile })
            await browser.close()
          }
        }),
      )
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e }
    }
  }

  private async runAssertions(page: Page, _browserName: string, ctx: StepContext) {
    const localUrl = this.config.appStart.preview?.url ?? this.config.appStart.dev?.url
    const deployUrl = process.env.TUTORIAL_AGENT_DEPLOY_URL // set by deploy step when implemented

    for (const assertion of this.config.assertions) {
      const baseUrl = assertion.url === 'local' ? localUrl : assertion.url === 'deploy' ? deployUrl : assertion.url
      if (!baseUrl) continue
      for (const action of assertion.actions) {
        await this.runAction(page, baseUrl, action, this.config.timeouts.actionMs)
      }
    }
  }

  private async runAction(page: Page, baseUrl: string, action: BrowserAction, actionTimeout: number) {
    switch (action.type) {
      case 'goto': {
        await page.goto(action.url ?? baseUrl, { timeout: actionTimeout, waitUntil: 'domcontentloaded' })
        break
      }
      case 'click': {
        await page.click(action.selector, { timeout: actionTimeout })
        break
      }
      case 'fill': {
        await page.fill(action.selector, action.text, { timeout: actionTimeout })
        break
      }
      case 'press': {
        await page.locator(action.selector).press(action.key, { timeout: actionTimeout })
        break
      }
      case 'expectText': {
        await page.waitForSelector(action.selector, { timeout: actionTimeout })
        const text = await page.locator(action.selector).innerText()
        if (!text.includes(action.text)) {
          throw new Error(
            `expectText failed for ${action.selector}: expected to include "${action.text}", got "${text}"`,
          )
        }
        break
      }
    }
  }
}
