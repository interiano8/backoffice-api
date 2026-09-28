# Proposal: Store Inheritance from Headquarters (000)

## Why

Today every store's configuration (RTN, emisor, moneda, telefono, correo, direccion, reglas de negocio, etc.) must be filled manually, store by store, in `BoStore`. This creates repetitive data entry and configuration drift between branches: the same company-wide values get typed once per station, and any mistake is duplicated N times. We want **ONE place to configure company-wide defaults (the headquarters/HQ store) and have new stores inherit them automatically**, so operators stop re-entering what the company already knows.

## What Changes

- **Seed/ensure a headquarters store (`code="000"`)** in `BoStore` with the company-wide defaults. On first setup, seed it with the values of the existing store `001` (RTN, emisor, moneda, telefono, correo, direccion, titulo, logoUrl, printCreditInvoices, moduleCustomers, SyncMinutes, PresentationMinutes) so no existing data is lost.
- **Store creation copies HQ defaults**: When creating a new store via `POST /stores`, the Backoffice API copies the headquarters store's company-wide fields into the new store record (values become editable per store). The UI does **not** require filling those fields on "New Store" — they are pre-filled from the HQ.
- **UI "New Store" form**: shows the company-wide fields pre-filled from HQ (editable but optional); only store-specific fields (code, name, ip, dbPort/dbName/dbUser/dbPassword, apiUrl, lanUrl, fusion/hardware) are mandatory.
- **UI store detail**: company-wide fields remain editable per store (a store may override HQ defaults). No reference/pointer semantics — a copy at creation time.
- **HQ store is not a deployable station**: the `000` store is present in `BoStore` as the config source but is not treated as an operational station for health/ping or as a POS.

## Capabilities

### New Capabilities
- `backoffice-store-copy-from-hq`: Covers the behavior of creating a store with its company-wide fields automatically copied from the headquarters store (`000`) and the ability for each store to override those values afterwards.

### Modified Capabilities
- `backoffice-multistore-pg`: The Backoffice store model now includes a headquarters store (`000`) used as the default source of company-wide configuration. Store creation behavior changes to pre-fill common fields from HQ.

## Impact

- **DB (`bo-prisma`)**: `BoStore` gains/uses the `000` row; no schema change required (fields already exist), only data seeding.
- **Backoffice API (`backoffice-api`)**: `stores.use-case.create()` copies HQ fields; seed logic to create/refresh store `000`.
- **Backoffice UI (`backoffice-ui`)**: "New Store" form pre-fills company fields from HQ; store detail keeps fields editable.
- **POS (`prisma_backend`)**: no change required (it already receives the full `storeConfig`; the copy happens upstream in the Backoffice).
- **Docs/runbook**: note that company-wide fields come from HQ.