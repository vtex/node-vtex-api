# Public-API snapshot

`index.d.ts.snapshot` is the **public-API manifest** for `@vtex/api`.

It is a **verbatim copy** of the `index.d.ts` file emitted by `tsc`
against `packages/lib/src/index.ts` at the post-carve-out point of
Phase 3 (after T024 trimmed the public surface and added 12 transitional
internal re-exports).

History of this file:

| Phase | Task | SHA-256 |
|------|------|---------|
| Phase 2 baseline (@vtex/api@7.3.1) | T013 | `9fb247650ec53e4128a957db074f5836ac638b249e106520f677078f184cb022` |
| Phase 3 post-carve-out             | T030 | `f43da6f06c62327174d69873d0a31b3d4eb1ff1ee1ab73572a5be2c09f5a5097` |

**Update discipline (SC-007):**

- During workstream C (Phase 3, tasks T019–T026), every symbol intentionally
  removed from `@vtex/api`'s public surface MUST be reflected here by
  regenerating the snapshot and listing the removed names in
  `packages/lib/CHANGELOG.md` (T029).
- T030 has tightened the test in `snapshot.test.ts` from **superset** to
  **equality**: any addition or removal vs this file fails CI. This file
  is the precision gate for SC-007.
- Any additive change to the public surface goes through the same gate
  (regenerate the snapshot in the same PR; reviewers diff this file).

**Do not edit by hand.** Always regenerate via:

```bash
cd packages/lib
yarn build
cp lib/index.d.ts tests/__public_api__/index.d.ts.snapshot
```
