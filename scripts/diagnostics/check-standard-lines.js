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
        const res = await pool.request().query("SELECT TOP 10 * FROM [POS Sales Header] WHERE [Posting Date] >= '2026-03-09'");
        console.log("Recent Headers:");
        console.table(res.recordset);
        
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
