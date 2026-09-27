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
        const resView = await pool.request().query("SELECT TOP 0 * FROM [vw_POS_Sales_With_Turnos]");
        console.log("Columns in [vw_POS_Sales_With_Turnos]:", Object.keys(resView.recordset.columns));
        
        const resCharge = await pool.request().query("SELECT TOP 0 * FROM [POS Sales Charge Line]");
        console.log("Columns in [POS Sales Charge Line]:", Object.keys(resCharge.recordset.columns));
        
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
