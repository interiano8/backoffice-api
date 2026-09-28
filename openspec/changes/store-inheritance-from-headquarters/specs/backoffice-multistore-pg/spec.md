## Purpose

Provides centralized multi-store PostgreSQL connectivity and real-time query capabilities for Backoffice operations across all registered service stations.

## Requirements

### Requirement: Centralized Store Connection Management
The Backoffice system SHALL maintain a dynamic connection pool for each registered store in `BoStore`, establishing direct PostgreSQL connections to the store POS database using its configured IP, port, and credentials.

#### Scenario: Successful connection to active store
- **WHEN** the user selects a store with valid PostgreSQL connection parameters
- **THEN** the system retrieves or creates a connection pool to that store database and executes queries successfully

#### Scenario: Fallback and error handling on store unreachable
- **WHEN** a selected store is offline or unreachable over the network
- **THEN** the system logs the connection failure and returns a clear descriptive error without crashing other store connections

### Requirement: Live Document and Customer Lookup
The Backoffice API SHALL execute live search queries directly against the active store PostgreSQL database for sales documents, customer records, and employee authentication.

#### Scenario: Searching documents in active store
- **WHEN** an auditor searches for invoices or credit notes specifying a store code and date range
- **THEN** the system queries the `ventas` and `lineas_venta` tables of that store and returns the matching document records

#### Scenario: Searching customer data in active store
- **WHEN** a user searches for customer account balance or details in a specific store
- **THEN** the system queries the `clientes` table of that store and returns customer information with billing type and balance

### Requirement: Fuel Controller Sales Comparison
The Backoffice API SHALL allow comparing fuel controller dispatches from `ventas_combustible` against billed invoices in `ventas` for the selected store.

#### Scenario: Querying controller dispatches for reconciliation
- **WHEN** a supervisor opens the controller reconciliation view for a given shift in a store
- **THEN** the system retrieves controller sales from the store `ventas_combustible` table and correlates them with POS invoice lines

## MODIFIED Requirements

### Requirement: Store Catalog Includes Headquarters Store
The Backoffice `BoStore` catalog SHALL include a headquarters store (`code="000"`) holding company-wide defaults, which is excluded from operational station monitoring.

#### Scenario: HQ store present and not monitored
- **WHEN** the Backoffice lists stores or runs health checks
- **THEN** the `000` store appears in the catalog but is excluded from health/ping checks and POS station operations