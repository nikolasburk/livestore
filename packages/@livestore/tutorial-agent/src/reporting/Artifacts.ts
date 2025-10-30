import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function ensureArtifactsDir(root = '.tutorial-artifacts') {
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

export function writeSummary(artifactsDir: string, summary: string) {
  writeFileSync(path.join(artifactsDir, 'summary.txt'), summary)
}
