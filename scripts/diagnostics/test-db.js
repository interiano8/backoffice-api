const sql = require('mssql');
async function test() {
    const config = {
        user: 'sa',
        password: 'astro',
        server: '209.126.85.139',
        database: 'TPV',
        options: { encrypt: false, trustServerCertificate: true }
    };
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query("SELECT TOP 1 * FROM vw_POS_Sales_With_Turnos");
        console.log("COLUMNS:", Object.keys(result.recordset[0]));
    } catch (e) { console.error(e); }
    process.exit(0);
}
test();
