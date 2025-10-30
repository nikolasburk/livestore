import { spawn } from 'node:child_process'
import type { Step, StepContext, StepResult } from '../core/Step.ts'

export class CloudflareStep implements Step {
  public readonly name: string
  private readonly command: string
  private readonly cwd: string

  constructor(name: string, command: string, cwd: string) {
    this.name = name
    this.command = command
    this.cwd = cwd
  }

  async run(ctx: StepContext): Promise<StepResult> {
    const hasSecrets = !!process.env.CLOUDFLARE_API_TOKEN && !!process.env.CLOUDFLARE_ACCOUNT_ID
    if (!hasSecrets) return { ok: true } // optional
    let output = ''
    const proc = spawn('bash', ['-lc', this.command], { cwd: this.cwd, env: ctx.env })
    proc.stdout.on('data', (d) => {
      output = output + d.toString()
    })
    proc.stderr.on('data', (d) => {
      output = output + d.toString()
    })
    const code = await new Promise<number>((res) => proc.on('close', res))
    if (code !== 0) return { ok: false, error: new Error(`Cloudflare command failed (${code})`) }
    const urlMatch = output.match(/https?:\/\/[^\s]+/)
    if (urlMatch) {
      ctx.env.TUTORIAL_AGENT_DEPLOY_URL = urlMatch[0]
    }
    return { ok: true }
  }
}
