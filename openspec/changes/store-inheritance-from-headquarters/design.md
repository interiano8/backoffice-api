# Design: Store Inheritance from Headquarters

## Context

See proposal.md — Why. The backoffice currently stores per-store configuration in `BoStore`, and each store must be filled manually. There is no `000` headquarters row today; the existing store is `001`. The proposal adds a headquarters store as the default source of company-wide fields, copied at store creation.

## Goals / Non-Goals

**Goals**
- One place to define company-wide store defaults (HQ `000`).
- New stores are pre-filled from HQ on creation; values are copied (owned by the store), not live-referenced.
- HQ is excluded from operational station monitoring.

**Non-Goals**
- Live inheritance / synchronized defaults after creation (explicitly copy-at-create; a store override stays).
- Multi-company / multi-HQ support (single HQ for now).
- Changing the POS-side `storeConfig` contract.

## Decisions

**D1: Model HQ as a normal `BoStore` row with `code="000"`**
- Rationale: no schema change; reuses existing fields and existing CRUD; the POS already receives full storeConfig from `BoStore`.
- Alternative considered (rejected): a separate `BoCompany` table — more moving parts, and multi-company is out of scope.

**D2: Copy-at-create (values owned by the store), not inheritance pointers**
- Rationale: simplest mental model; a store that wants to differ just edits its row; no runtime merge logic in the POS.
- Alternative considered (rejected): `null`-means-inherit — requires merge logic in every reader and complicates the POS bootstrap.

**D3: Seed/refresh HQ from store `001` on first setup**
- Rationale: preserves existing data and avoids asking the operator to re-type company fields; seed runs only if `000` missing.
- Note: seed is a one-time bootstrap; afterwards HQ is operator-edited like any store.

**D4: HQ exclusion from operational checks**
- Rationale: `000` is a config source, not a station; health/ping and store lists that drive station operations filter it out, while the store catalog still shows it.

## Risks / Trade-offs

- **Stale defaults**: stores created before an HQ update keep old values (copy semantics). → Accepted; documented; operator can update a store manually.
- **Accidental station creation with code 000**: operator could create a real station `000`. → Reserve `000` in the create endpoint (reject `code="000"` for new stations).
- **Seed copying partial data** if `001` is partially filled. → Seed copies only non-null company fields.

## Migration Plan

1. Add seed logic (backoffice-api) to ensure `BoStore` row `code="000"` exists, copying company fields from the first existing store (e.g., `001`).
2. Deploy backoffice-api → on start, HQ row is created.
3. Verify: `SELECT * FROM "BoStore" WHERE code='000'`.
4. Extend `create` (stores.use-case) to pre-fill company fields from HQ; extend UI "New Store" form to show them pre-filled.

Rollback: remove the HQ row and revert create/UI changes; no data migration needed (copy semantics mean no existing store is altered).

## Open Questions

- Should the "New Store" form allow leaving company fields blank to intentionally skip company defaults (e.g., third-party stations)? — Defer; current copy-always behavior is acceptable and spec-conformant.