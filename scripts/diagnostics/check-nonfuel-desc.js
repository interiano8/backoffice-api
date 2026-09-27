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
        const res = await pool.request().query("SELECT DISTINCT [Description], [Pump No_] FROM [vw_POS_Sales_With_Turnos] WHERE [Description] NOT LIKE '%SUPER%' AND [Description] NOT LIKE '%REGULAR%' AND [Description] NOT LIKE '%DIESEL%' AND [Description] NOT LIKE '%LPG%'");
        console.table(res.recordset);
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
