import { z } from 'zod'

export const BrowserActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('goto'), url: z.string().optional() }),
  z.object({ type: z.literal('click'), selector: z.string() }),
  z.object({ type: z.literal('fill'), selector: z.string(), text: z.string() }),
  z.object({ type: z.literal('press'), selector: z.string(), key: z.string() }),
  z.object({ type: z.literal('expectText'), selector: z.string(), text: z.string() }),
])

export type BrowserAction = z.infer<typeof BrowserActionSchema>

export const ConfigSchema = z.object({
  tutorialFiles: z.array(z.string()).nonempty(),
  // starterRepo: z.string(),
  appStart: z.object({
    dev: z.object({ command: z.string(), url: z.string() }).optional(),
    preview: z.object({ build: z.string(), serve: z.string(), url: z.string() }).optional(),
  }),
  browsers: z.array(z.enum(['chromium', 'webkit', 'firefox'])).default(['chromium']),
  assertions: z
    .array(
      z.object({
        name: z.string(),
        url: z.enum(['local', 'deploy']).or(z.string()),
        actions: z.array(BrowserActionSchema),
      }),
    )
    .default([]),
  cloudflare: z
    .object({
      enabled: z.union([z.literal('auto'), z.literal('on'), z.literal('off')]).default('auto'),
      wranglerEnv: z.string().default('production'),
    })
    .default({ enabled: 'auto', wranglerEnv: 'production' }),
  timeouts: z
    .object({ stepMs: z.number().default(600000), actionMs: z.number().default(30000) })
    .default({ stepMs: 600000, actionMs: 30000 }),
})

export type TutorialAgentConfig = z.infer<typeof ConfigSchema>

export function defineConfig(config: TutorialAgentConfig): TutorialAgentConfig {
  return ConfigSchema.parse(config)
}

export * from './core/Runner.ts'
