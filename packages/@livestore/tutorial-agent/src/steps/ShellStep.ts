import { spawn } from 'node:child_process'
// import path from 'node:path'
import { createWriteStream, existsSync } from 'node:fs'
import path from 'node:path'
import type { Step, StepContext, StepResult } from '../core/Step.ts'

type Options = {
  timeoutMs?: number
  background?: boolean
  logFile?: string
}

export class ShellStep implements Step {
  public readonly name: string
  private readonly command: string
  private readonly cwd: string
  private readonly options: Options

  constructor(name: string, command: string, cwd: string, options: Options = {}) {
    this.name = name
    this.command = command
    this.cwd = cwd
    this.options = options
  }

  async run(ctx: StepContext): Promise<StepResult> {
    // Resolve shell in a cross-platform and environment-aware way.
    // Prefer the invoking user's shell, fall back to common POSIX shells; on Windows use cmd.exe.
    const isWindows = process.platform === 'win32'
    let shellExecutable: string
    let args: string[]

    if (isWindows) {
      shellExecutable = process.env.Comspec || process.env.ComSpec || 'cmd.exe'
      args = ['/d', '/s', '/c', this.command]
    } else {
      // Probe common shells in order of preference and pick the first that exists
      const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(Boolean) as string[]
      shellExecutable = candidates.find((s) => existsSync(s)) || 'sh'
      const shellName = path.basename(shellExecutable)
      const useLogin = shellName === 'zsh' || shellName === 'bash'
      args = useLogin ? ['-lc', this.command] : ['-c', this.command]
    }

    const proc = spawn(shellExecutable, args, {
      cwd: this.cwd,
      env: ctx.env,
      stdio: this.options.logFile ? 'pipe' : 'inherit',
    })
    let timedOut = false
    let timer: NodeJS.Timeout | undefined
    if (this.options.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGKILL')
      }, this.options.timeoutMs)
    }

    if (this.options.logFile) {
      const stream = createWriteStream(this.options.logFile, { flags: 'a' })
      proc.stdout?.pipe(stream)
      proc.stderr?.pipe(stream)
    }

    if (this.options.background) {
      // Give it a moment to start
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 3000))
      return { ok: true }
    }

    const exitCode = await new Promise<number>((resolve) => proc.on('close', resolve))
    if (timer) clearTimeout(timer)
    if (timedOut) return { ok: false, error: new Error(`Command timed out: ${this.command}`) }
    if (exitCode !== 0) return { ok: false, error: new Error(`Command failed (${exitCode}): ${this.command}`) }
    return { ok: true }
  }
}
