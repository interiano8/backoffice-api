import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 5 },  // Ramp up to 5 concurrent sync requests
    { duration: '30s', target: 10 }, // Stay at 10 concurrent requests
    { duration: '15s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of sync requests complete under 3s
    http_req_failed: ['rate<0.05'],    // Less than 5% error rate
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

  const payload = JSON.stringify({
    reconcilerShiftId: 'test-shift-load-id',
  });

  const res = http.post(`${BASE_URL}/etl/sync`, payload, params);

  check(res, {
    'status is 200 or 409 (lock handled)': (r) => r.status === 200 || r.status === 409,
  });

  sleep(2);
}
