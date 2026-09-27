import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 virtual users
    { duration: '1m', target: 50 },  // Stay at 50 virtual users
    { duration: '30s', target: 0 },  // Ramp down to 0 virtual users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% error rate
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const STORE_CODE = __ENV.STORE_CODE || 'STORE01';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'x-store-code': STORE_CODE,
    },
  };

  const res = http.get(`${BASE_URL}/reports/dashboard?date=2026-08-31`, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
