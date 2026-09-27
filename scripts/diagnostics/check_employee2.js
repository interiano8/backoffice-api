const sql = require('mssql');

async function check() {
  const connString = "sqlserver://192.168.1.104:14331;database=TPV;user=sa;password=SilverNo!.2026;encrypt=false;trustServerCertificate=true;connection_limit=60";
  try {
    const pool = await sql.connect(connString);
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Employee2'
    `);
    console.log(result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}

check();
