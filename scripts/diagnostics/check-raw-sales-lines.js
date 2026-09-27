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
        const res = await pool.request().query("SELECT TOP 20 [No_], [Description], [Item Category Code], [Pump No_] FROM [POS Sales Line] WHERE [Pump No_] = '' OR [Pump No_] IS NULL");
        console.log("Non-Pump Sales Lines Samples:");
        console.table(res.recordset);

        const resAllCategories = await pool.request().query("SELECT DISTINCT [Item Category Code] FROM [POS Sales Line]");
        console.log("All Categories in [POS Sales Line]:");
        console.table(resAllCategories.recordset);

        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
