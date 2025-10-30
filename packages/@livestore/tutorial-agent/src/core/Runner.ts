import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { TutorialAgentConfig } from '../index.ts'
import type { Step, StepContext } from './Step.ts'
import { ShellStep } from '../steps/ShellStep.ts'
import { BrowserStep } from '../steps/BrowserStep.ts'
import { parseMdxFiles } from '../parsers/mdx.ts'
import { FileEditStep } from '../steps/FileEditStep.ts'
import { CloudflareStep } from '../steps/CloudflareStep.ts'

export class Runner {
  private readonly config: TutorialAgentConfig
  constructor(config: TutorialAgentConfig) {
    this.config = config
  }

  async run(): Promise<number> {
    const artifactsDir = path.resolve('.tutorial-artifacts')
    if (!existsSync(artifactsDir)) {
      console.log(`[Runner] Creating artifacts directory at: ${artifactsDir}`)
      mkdirSync(artifactsDir, { recursive: true })
    } else {
      console.log(`[Runner] Using existing artifacts directory at: ${artifactsDir}`)
    }
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'tutorial-agent-'))
    console.log(`[Runner] Created workspace directory at: ${workspaceDir}`)
    const appDir = path.join(workspaceDir, 'app')
    console.log(`[Runner] App directory will be: ${appDir}`)

    const ctx: StepContext = {
      workspaceDir,
      appDir,
      artifactsDir,
      env: process.env,
    }

    const steps: Step[] = []

    // Parse tutorial MDX and enqueue commands (resolve paths from invoking shell dir)
    const baseDir = process.env.TUTORIAL_AGENT_BASEDIR || process.cwd()
    const tutorialPaths = this.config.tutorialFiles.map((p) => path.resolve(baseDir, p))
    console.log('[Runner] Load tutorial files: `', tutorialPaths)
    const parsed = await parseMdxFiles(tutorialPaths)
    for (const st of parsed) {
      if ((st as any).kind === 'file') {
        const fst = st as unknown as { kind: 'file'; file: string; mode: 'write' | 'append'; content: string }
        console.log('[Runner] Add file-edit: ', fst.file, fst.mode)
        steps.push(new FileEditStep(`Edit file: ${fst.file}`, fst.file, fst.mode, fst.content))
      } else {
        const cwd = (st as any).cwd ?? appDir
        const command = (st as any).command
        console.log('[Runner] Add step: `', command, '` to `', cwd, '`')
        steps.push(
          new ShellStep(`Tutorial: ${(st as any).kind}`, command, cwd, { timeoutMs: this.config.timeouts.stepMs }),
        )
      }
    }

    // Ensure deps installed (in case tutorial didn’t specify)
    steps.push(
      new ShellStep('Install deps', `pnpm install --frozen-lockfile`, appDir, {
        timeoutMs: this.config.timeouts.stepMs,
      }),
    )

    // Start app (preview preferred for stability)
    if (this.config.appStart.preview) {
      steps.push(
        new ShellStep('Build app', this.config.appStart.preview.build, appDir, {
          timeoutMs: this.config.timeouts.stepMs,
        }),
      )
      const serveCmd = this.config.appStart.preview.serve
      // Background serve
      steps.push(
        new ShellStep('Serve app', serveCmd, appDir, {
          background: true,
          logFile: path.join(artifactsDir, 'preview.log'),
        }),
      )
    } else if (this.config.appStart.dev) {
      const devCmd = this.config.appStart.dev.command
      steps.push(
        new ShellStep('Dev server', devCmd, appDir, { background: true, logFile: path.join(artifactsDir, 'dev.log') }),
      )
    }

    // Optional Cloudflare deploy (collect URL into env)
    if (this.config.cloudflare.enabled !== 'off') {
      steps.push(
        new CloudflareStep(
          'Deploy to Cloudflare (optional)',
          `pnpm dlx wrangler deploy --env ${this.config.cloudflare.wranglerEnv}`,
          appDir,
        ),
      )
    }

    // Browser assertions
    steps.push(new BrowserStep('Browser assertions', this.config))

    let code = 0
    for (const step of steps) {
      const start = Date.now()
      const result = await step.run(ctx)
      const line = `[${new Date().toISOString()}] ${step.name} ${result.ok ? 'OK' : 'FAIL'} in ${Date.now() - start}ms\n`
      writeFileSync(path.join(artifactsDir, 'run.log'), line, { flag: 'a' })
      if (!result.ok) {
        const err = 'error' in result && result.error ? result.error : new Error('Unknown error')
        writeFileSync(
          path.join(artifactsDir, 'errors.log'),
          `${step.name}: ${(err as Error).stack || (err as Error).message}\n`,
          { flag: 'a' },
        )
        code = 1
        break
      }
    }

    return code
  }
}
