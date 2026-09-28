# Tasks: Store Inheritance from Headquarters

## 1. Seed / HQ Store bootstrap

- [ ] 1.1 Add HQ seed logic in backoffice-api that ensures a `BoStore` row with `code="000"` exists, copying company-wide fields (RTN, emisor, moneda, telefono, correo, direccion, titulo, logoUrl, printCreditInvoices, moduleCustomers, SyncMinutes, PresentationMinutes) from the first existing store; run at startup (idempotent) and verify `SELECT * FROM "BoStore" WHERE code='000'` returns the copied values.

## 2. Backend: create store copies HQ defaults

- [ ] 2.1 In stores.use-case `create`, reject `code="000"` for a new station (throw conflict) and verify a request with code 000 fails.
- [ ] 2.2 In stores.use-case `create`, when the HQ store exists, pre-fill the new store's company-wide fields from HQ when the payload leaves them null/undefined; verify a created store has HQ's values for those fields.
- [ ] 2.3 Ensure HQ exclusion: store health/ping and store lists used for station operations exclude `code="000"`; verify `GET /stores` still returns HQ but health summary does not include it.

## 3. UI: New Store pre-fills company fields from HQ

- [ ] 3.1 In backoffice-ui "New Store" form, pre-fill company-wide fields with the HQ store values (loaded via the store catalog) and verify they render pre-filled and are not required.
- [ ] 3.2 Verify in the UI that store-specific fields (code, name, connection, hardware) remain mandatory and that saving a new store persists HQ-copied values (observable in `BoStore`).

## 4. Verification / integration

- [ ] 4.1 Full flow test: with HQ `000` configured, create a new store via API and via UI; confirm company fields are copied and editable; confirm `code="000"` is rejected for new stations; confirm HQ is absent from health checks.