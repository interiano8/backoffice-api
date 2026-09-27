# Performance and Load Testing with k6

This directory contains load and stress testing scripts for `backoffice-api` using [k6](https://k6.io/).

## Prerequisites
Install k6:
```bash
# Ubuntu / Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Running Scenarios

### 1. Dashboard Endpoint Load Test
Simulates up to 50 concurrent virtual users querying the daily dashboard report.
```bash
k6 run test/performance/dashboard-load.js \
  -e API_URL=http://localhost:3000 \
  -e STORE_CODE=STORE01 \
  -e JWT_TOKEN="<YOUR_BEARER_TOKEN>"
```

### 2. ETL Synchronization Concurrency Test
Simulates concurrent ETL sync triggers to validate distributed lock stability and database transaction performance.
```bash
k6 run test/performance/etl-sync-load.js \
  -e API_URL=http://localhost:3000 \
  -e STORE_CODE=STORE01 \
  -e JWT_TOKEN="<YOUR_BEARER_TOKEN>"
```

## Performance Quality Gates
- **p95 Latency**: < 500ms for read endpoints (`/reports/dashboard`), < 3000ms for sync endpoints (`/etl/sync`).
- **Error Rate**: < 1% for standard read requests.
