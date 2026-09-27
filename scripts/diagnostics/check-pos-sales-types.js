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
        // Let's look for a shift that has both fuel and non-fuel if possible, 
        // or just look at the distribution of Pump No_ and Description
        const res = await pool.request().query("SELECT TOP 20 [Description], [Pump No_], [manguera_numero], [Item Category Code], [Amount Including VAT] FROM [vw_POS_Sales_With_Turnos] WHERE [Pump No_] IS NULL OR [Pump No_] = ''");
        console.log("Non-Fuel (?) Samples:");
        console.table(res.recordset);
        
        const resFuel = await pool.request().query("SELECT TOP 5 [Description], [Pump No_], [manguera_numero], [Item Category Code], [Amount Including VAT] FROM [vw_POS_Sales_With_Turnos] WHERE [Pump No_] IS NOT NULL AND [Pump No_] <> ''");
        console.log("Fuel Samples:");
        console.table(resFuel.recordset);
        
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
