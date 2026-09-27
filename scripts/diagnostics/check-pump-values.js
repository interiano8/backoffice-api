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
        const res = await pool.request().query("SELECT DISTINCT [Pump No_] FROM [vw_POS_Sales_With_Turnos]");
        console.table(res.recordset);
        
        const res2 = await pool.request().query("SELECT DISTINCT [Description] FROM [vw_POS_Sales_With_Turnos] WHERE [Pump No_] NOT IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16')");
        console.log("Non-standard Pump No_ samples:");
        console.table(res2.recordset);

        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
