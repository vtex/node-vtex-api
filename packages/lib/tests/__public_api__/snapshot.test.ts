/**
 * Public-API snapshot test.
 *
 * Asserts that the compiled `lib/index.d.ts` (the published .d.ts entry
 * point of @vtex/api) re-exports every namespace listed in the captured
 * snapshot file (`index.d.ts.snapshot`).
 *
 * At T014's introduction this is a SUPERSET check: the compiled file
 * MUST contain every `export *` line in the snapshot, but is allowed
 * to contain additional ones. T030 (Phase 3) tightens it to equality
 * once the runtime carve-out is complete.
 */

import * as fs from 'fs'
import * as path from 'path'

const SNAPSHOT_PATH = path.join(__dirname, 'index.d.ts.snapshot')
const COMPILED_PATH = path.join(__dirname, '../../lib/index.d.ts')

function parseExportLines(source: string): Set<string> {
  return new Set(
    source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('//'))
  )
}

describe('@vtex/api public-API snapshot', () => {
  let snapshotLines: Set<string>
  let compiledLines: Set<string>

  beforeAll(() => {
    if (!fs.existsSync(COMPILED_PATH)) {
      throw new Error(
        `Compiled lib not found at ${COMPILED_PATH}. ` +
          `Run 'yarn build' in packages/lib before running this test.`
      )
    }
    snapshotLines = parseExportLines(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    compiledLines = parseExportLines(fs.readFileSync(COMPILED_PATH, 'utf8'))
  })

  it('compiled lib/index.d.ts contains every export listed in the snapshot (superset check)', () => {
    const missing: string[] = []
    for (const line of snapshotLines) {
      if (!compiledLines.has(line)) {
        missing.push(line)
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Public-API regression: the following exports from the snapshot ` +
          `are missing from the compiled lib/index.d.ts:\n  ` +
          missing.join('\n  ') +
          `\n\nIf this removal is intentional, regenerate the snapshot ` +
          `and add an entry to packages/lib/CHANGELOG.md (T029).`
      )
    }
    expect(missing).toEqual([])
  })

  it('snapshot file is not empty (guards against accidental truncation)', () => {
    expect(snapshotLines.size).toBeGreaterThan(0)
  })
})
