## Purpose

Defines how new stores inherit their company-wide configuration from the headquarters (HQ) store, so operators do not re-enter company defaults per station.

## ADDED Requirements

### Requirement: Headquarters Store Exists
The Backoffice system SHALL maintain a headquarters store with code `000` in `BoStore` that holds company-wide configuration defaults (RTN, emisor, moneda, telefono, correo, direccion, titulo, logoUrl, printCreditInvoices, moduleCustomers, SyncMinutes, PresentationMinutes).

#### Scenario: HQ store present after setup
- **WHEN** the Backoffice system initializes and no HQ store exists
- **THEN** it creates `BoStore` row `code="000"` and, if any other store already exists, copies that store's company-wide field values into the HQ store

#### Scenario: HQ store is not an operational station
- **WHEN** the system lists stores for health monitoring or POS operations
- **THEN** the `000` store is excluded from health/ping checks and is not treated as a deployable POS station

### Requirement: New Stores Copy Company-Wide Defaults from HQ
When an operator creates a new store, the Backoffice SHALL pre-populate the new store's company-wide fields with the values of the headquarters store, and the new store record SHALL own those copied values (editable afterwards, with no runtime reference to HQ).

#### Scenario: Creating a new store pre-fills company fields
- **WHEN** an operator creates a store without specifying company-wide fields (RTN, emisor, moneda, telefono, correo, direccion, titulo, logoUrl, printCreditInvoices, moduleCustomers, SyncMinutes, PresentationMinutes)
- **THEN** the created store has those fields populated with the headquarters store's current values

#### Scenario: Overriding HQ defaults per store
- **WHEN** an operator edits a store's company-wide field after creation
- **THEN** the store keeps its own overridden value and subsequent store creations do not affect it

#### Scenario: Stocking stores keep HQ defaults even if HQ changes later
- **WHEN** the headquarters store values are updated after stores were created
- **THEN** existing stores retain the values they had at creation time (copy semantics, not live inheritance)

### Requirement: HQ as New-Store Form Defaults
The Backoffice UI "New Store" form SHALL display the company-wide fields pre-filled from the HQ store and SHALL NOT require the operator to fill them; store-specific fields (code, name, connection, and hardware settings) remain mandatory.

#### Scenario: New store form pre-filled
- **WHEN** an operator opens the "New Store" form
- **THEN** company-wide fields are shown pre-filled with the HQ values and may be left as-is or edited before saving