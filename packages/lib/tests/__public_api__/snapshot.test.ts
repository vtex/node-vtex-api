/**
 * Public-API snapshot test.
 *
 * Asserts that the compiled `lib/index.d.ts` (the published .d.ts entry
 * point of @vtex/api) re-exports every namespace listed in the captured
 * snapshot file (`index.d.ts.snapshot`).
 *
 * As of T030 (Phase 3, post-carve-out), this is an EQUALITY check: the
 * compiled file MUST contain EXACTLY the export lines in the snapshot —
 * no additions, no removals. Any drift surfaces as a test failure and
 * forces a deliberate update of the snapshot + a CHANGELOG entry.
 *
 * History:
 *   T014 (Phase 2) — superset check against @vtex/api 7.3.1 baseline.
 *   T030 (Phase 3) — tightened to equality against the post-carve-out
 *                    surface (12 transitional internal re-exports added,
 *                    1 './service' barrel removed; net +11 lines).
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
        `Compiled lib not found at ${COMPILED_PATH}. ` + `Run 'yarn build' in packages/lib before running this test.`
      )
    }
    snapshotLines = parseExportLines(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    compiledLines = parseExportLines(fs.readFileSync(COMPILED_PATH, 'utf8'))
  })

  it('compiled lib/index.d.ts contains every export listed in the snapshot (no removals)', () => {
    const missing: string[] = []
    for (const line of snapshotLines) {
      if (!compiledLines.has(line)) {
        missing.push(line)
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Public-API regression — the following exports from the snapshot ` +
          `are missing from the compiled lib/index.d.ts:\n  ` +
          missing.join('\n  ') +
          `\n\nIf this removal is intentional, regenerate the snapshot ` +
          `and add an entry to packages/lib/CHANGELOG.md (T029).`
      )
    }
    expect(missing).toEqual([])
  })

  it('compiled lib/index.d.ts adds no exports beyond the snapshot (no unintended additions)', () => {
    const unexpected: string[] = []
    for (const line of compiledLines) {
      if (!snapshotLines.has(line)) {
        unexpected.push(line)
      }
    }
    if (unexpected.length > 0) {
      throw new Error(
        `Public-API expansion detected — the following exports are in the ` +
          `compiled lib/index.d.ts but not in the snapshot:\n  ` +
          unexpected.join('\n  ') +
          `\n\nIf this addition is intentional, regenerate the snapshot ` +
          `(cp packages/lib/lib/index.d.ts packages/lib/tests/__public_api__/index.d.ts.snapshot) ` +
          `and add an entry to packages/lib/CHANGELOG.md describing the new ` +
          `public symbol(s).`
      )
    }
    expect(unexpected).toEqual([])
  })

  it('snapshot file is not empty (guards against accidental truncation)', () => {
    expect(snapshotLines.size).toBeGreaterThan(0)
  })
})
