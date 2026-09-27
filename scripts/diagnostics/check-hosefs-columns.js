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
        const res = await pool.request().query("SELECT TOP 0 * FROM [HoseFS]");
        console.log("Column names in [HoseFS]:", Object.keys(res.recordset.columns));
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
