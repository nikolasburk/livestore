#!/usr/bin/env node
import path from 'node:path'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { register } from 'esbuild-register/dist/node'
import { ConfigSchema } from '../index.ts'
import { Runner } from '../core/Runner.ts'

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  if (cmd !== 'validate') {
    console.error('Usage: tutorial-agent validate --config <file>')
    process.exit(2)
  }
  const configFlagIndex = args.indexOf('--config')
  if (configFlagIndex === -1 || !args[configFlagIndex + 1]) {
    console.error('Missing --config <file>')
    process.exit(2)
  }
  const configArg = args[configFlagIndex + 1] as string
  const baseDir = process.env.INIT_CWD || process.cwd()
  let configPath = path.resolve(baseDir, configArg)
  console.log('configPath', configPath)
  if (!existsSync(configPath)) {
    // Fallback: resolve relative to current working dir and its parents (pnpm exec case)
    let probe = process.cwd()
    for (let i = 0; i < 6 && !existsSync(configPath); i++) {
      const candidate = path.resolve(probe, configArg)
      if (existsSync(candidate)) {
        configPath = candidate
        break
      }
      const parent = path.dirname(probe)
      if (parent === probe) break
      probe = parent
    }
  }
  register({ target: 'es2022' })
  const mod = await import(pathToFileURL(configPath).href)
  const config = ConfigSchema.parse(mod.default ?? mod.config ?? mod)

  const configDir = path.dirname(configPath)
  const projectRoot = path.resolve(configDir, '..')
  process.env.TUTORIAL_AGENT_BASEDIR = projectRoot

  const runner = new Runner(config)
  const code = await runner.run()
  process.exit(code)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
