import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import type { Step, StepContext, StepResult } from '../core/Step.ts'

export type FileEditMode = 'write' | 'append'

export class FileEditStep implements Step {
  public readonly name: string
  private readonly filePath: string
  private readonly mode: FileEditMode
  private readonly content: string

  constructor(name: string, filePath: string, mode: FileEditMode, content: string) {
    this.name = name
    this.filePath = filePath
    this.mode = mode
    this.content = content
  }

  async run(ctx: StepContext): Promise<StepResult> {
    try {
      const absPath = path.isAbsolute(this.filePath) ? this.filePath : path.resolve(ctx.appDir, this.filePath)
      const dir = path.dirname(absPath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      if (this.mode === 'write') {
        writeFileSync(absPath, this.content, 'utf8')
      } else if (this.mode === 'append') {
        appendFileSync(absPath, this.content, 'utf8')
      }
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e }
    }
  }
}
