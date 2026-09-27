require('dotenv').config();
const sql = require('mssql');

async function check() {
    try {
        const pool = await sql.connect(process.env.TPV_DATABASE_URL);
        const result = await pool.request().query("SELECT TOP 1 * FROM [POS Sales Header] WITH (NOLOCK)");
        console.log("Columns:", Object.keys(result.recordset[0]));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
