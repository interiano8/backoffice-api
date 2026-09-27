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
        const res = await pool.request().query("SELECT COUNT(*) as Total, SUM(CASE WHEN [Pump No_] IS NULL OR [Pump No_] = '' THEN 1 ELSE 0 END) as NonFuel FROM [vw_POS_Sales_With_Turnos]");
        console.log("Distribution in view:");
        console.table(res.recordset);
        
        if (res.recordset[0].NonFuel > 0) {
            const samples = await pool.request().query("SELECT TOP 5 [Description], [Amount Including VAT] FROM [vw_POS_Sales_With_Turnos] WHERE [Pump No_] IS NULL OR [Pump No_] = ''");
            console.log("Non-Fuel Samples:");
            console.table(samples.recordset);
        }

        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
