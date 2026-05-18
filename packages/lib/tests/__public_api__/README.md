# Public-API snapshot

`index.d.ts.snapshot` is the **public-API manifest** for `@vtex/api`.

It is a **verbatim copy** of the `index.d.ts` file emitted by `tsc`
against `packages/lib/src/index.ts` immediately after the source
relocation in T011. It records the public surface of `@vtex/api@7.3.1`
(SHA-256 `9fb247650ec53e4128a957db074f5836ac638b249e106520f677078f184cb022`).

**Update discipline (SC-007):**

- During workstream C (Phase 3, tasks T019–T026), every symbol intentionally
  removed from `@vtex/api`'s public surface MUST be reflected here by
  regenerating the snapshot and listing the removed names in
  `packages/lib/CHANGELOG.md` (T029).
- T030 tightens the test in `snapshot.test.ts` from **superset** to
  **equality**, making this file the precision gate for SC-007.
- Any additive change to the public surface goes through the same gate
  (regenerate the snapshot in the same PR; reviewers diff this file).

**Do not edit by hand.** Always regenerate via:

```bash
cd packages/lib
yarn build
cp lib/index.d.ts tests/__public_api__/index.d.ts.snapshot
```
