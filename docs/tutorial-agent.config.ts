import { defineConfig } from '../packages/@livestore/tutorial-agent/dist/index.js'

export default defineConfig({
  tutorialFiles: [
    'docs/src/content/docs/tutorial/0-welcome.mdx',
    'docs/src/content/docs/tutorial/1-setup-starter-project.mdx',
    'docs/src/content/docs/tutorial/2-deploy-to-cloudflare.mdx',
    'docs/src/content/docs/tutorial/3-read-and-write-todos-via-livestore.mdx',
    'docs/src/content/docs/tutorial/4-sync-data-via-cloudflare.mdx',
    'docs/src/content/docs/tutorial/5-expand-business-logic.mdx',
    'docs/src/content/docs/tutorial/6-persist-ui-state.mdx',
  ],
  // starterRepo: 'https://github.com/nikolasburk/livestore-tutorial-starter',
  appStart: {
    preview: { build: 'pnpm build', serve: 'pnpm preview', url: 'http://localhost:4173' },
    dev: { command: 'pnpm dev', url: 'http://localhost:5173' },
  },
  browsers: ['chromium', 'webkit'],
  assertions: [
    {
      name: 'Add todo locally',
      url: 'local',
      actions: [
        { type: 'goto' },
        { type: 'fill', selector: '[data-testid="new-todo"]', text: 'walk the dog' },
        { type: 'press', selector: '[data-testid="new-todo"]', key: 'Enter' },
        { type: 'expectText', selector: '[data-testid="todo-item-text"]:last-child', text: 'walk the dog' },
      ],
    },
    {
      name: 'Cloudflare sync (optional)',
      url: 'deploy',
      actions: [
        { type: 'goto' },
        { type: 'expectText', selector: '[data-testid="todo-item-text"]:last-child', text: 'walk the dog' },
      ],
    },
  ],
  cloudflare: { enabled: 'auto', wranglerEnv: 'production' },
  timeouts: { stepMs: 600000, actionMs: 30000 },
})
