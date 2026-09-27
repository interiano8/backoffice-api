export async function withDb<T>(
  connectionFn: () => Promise<any>,
  fn: (pool: any) => Promise<T>,
): Promise<T> {
  const pool = await connectionFn();
  try {
    return await fn(pool);
  } finally {
    if (pool?.connected) await pool.close();
  }
}
