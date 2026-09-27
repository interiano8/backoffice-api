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
        const res = await pool.request().query("SELECT DISTINCT [Item Category Code] FROM [vw_POS_Sales_With_Turnos]");
        console.log("Distinct Item Category Codes in view:");
        console.table(res.recordset);
        
        const res2 = await pool.request().query("SELECT TOP 5 [Description], [Item Category Code] FROM [vw_POS_Sales_With_Turnos] WHERE [Item Category Code] <> ''");
        console.log("Samples with category:");
        console.table(res2.recordset);

        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
