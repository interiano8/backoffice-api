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
        const res = await pool.request().query("SELECT TOP 20 [Description], [No_], [Quantity], [Amount Including VAT], [Pump No_] FROM [POS Sales Line] WHERE [Pump No_] = '' OR [Pump No_] IS NULL");
        console.table(res.recordset);
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
