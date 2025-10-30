import { readFileSync } from 'node:fs'

export type ParsedStep =
  | {
      kind: 'shell' | 'npm' | 'wrangler'
      command: string
      cwd?: string
    }
  | {
      kind: 'file'
      file: string
      mode: 'write' | 'append'
      content: string
    }

const LANG_TO_KIND: Record<string, 'shell' | 'npm' | 'wrangler'> = {
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell',
  shell: 'shell',
  npm: 'npm',
  pnpm: 'npm',
  wrangler: 'wrangler',
}

export async function parseMdxFiles(files: string[]): Promise<ParsedStep[]> {
  const steps: ParsedStep[] = []
  const fenceRegex = /```([a-zA-Z0-9_-]+)([^\n]*)\n([\s\S]*?)```/g
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    let match: RegExpExecArray | null = fenceRegex.exec(content)
    while (match) {
      const langRaw = match[1]
      const infoRaw = match[2] ?? ''
      const codeRaw = match[3]
      const lang = (langRaw ?? '').trim()
      const info = (infoRaw ?? '').trim()
      const code = (codeRaw ?? '').trim()
      if (!lang || !code) {
        match = fenceRegex.exec(content)
        continue
      }

      // Handle file-edit fences: require file= in the info string, optional mode=
      const fileMatch = info.match(/\bfile=([^\s]+)\b/)
      if (fileMatch) {
        const file = (fileMatch[1] ?? '').trim()
        if (!file) {
          match = fenceRegex.exec(content)
          continue
        }
        const modeMatch = info.match(/\bmode=(write|append)\b/)
        const mode = (modeMatch?.[1] as 'write' | 'append') ?? 'write'
        steps.push({ kind: 'file', file, mode, content: code })
        match = fenceRegex.exec(content)
        continue
      }

      const kind = LANG_TO_KIND[lang as keyof typeof LANG_TO_KIND]
      if (kind) {
        const k: 'shell' | 'npm' | 'wrangler' = kind
        steps.push({ kind: k, command: normalizeCommand(k, lang, code) })
      }
      match = fenceRegex.exec(content)
    }
  }
  return steps
}

function normalizeCommand(kind: ParsedStep['kind'], lang: string, code: string): string {
  if (kind === 'npm' && (lang === 'npm' || lang === 'pnpm')) {
    const lines = code
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.map((l) => (lang === 'pnpm' ? `pnpm ${l}` : `npm ${l}`)).join(' && ')
  }
  return code
}
