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
        const res = await pool.request().query("SELECT COUNT(*) as Count, MAX([fecha_turno]) as MaxDate FROM [vw_POS_Sales_With_Turnos] WHERE [fecha_turno] >= '2026-03-01'");
        console.table(res.recordset);
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
