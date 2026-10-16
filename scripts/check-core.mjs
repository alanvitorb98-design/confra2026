#!/usr/bin/env node
// Lists every tracked file under src/ except src/brand/ with its SHA-256, so two copies of the app
// (the Confra and the wedding) can be compared: run it in each repo and diff the outputs.
//   node scripts/check-core.mjs > a.txt   (in one repo)
//   node scripts/check-core.mjs > b.txt   (in the other)
//   diff a.txt b.txt                      (no output = same core)
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = execFileSync('git', ['ls-files', '-z', '--', 'src'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter((f) => f && !f.startsWith('src/brand/'))
  .sort()

for (const f of files) {
  const hash = createHash('sha256').update(readFileSync(join(root, f))).digest('hex')
  console.log(`${hash}  ${f}`)
}
