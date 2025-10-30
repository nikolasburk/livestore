import { ShellStep } from './ShellStep.ts'

export class NpmStep extends ShellStep {
  constructor(name: string, args: string, cwd: string) {
    super(name, `pnpm ${args}`, cwd)
  }
}
