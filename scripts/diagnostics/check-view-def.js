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
        const res = await pool.request().query("SELECT OBJECT_DEFINITION(OBJECT_ID('vw_POS_Sales_With_Turnos')) as ViewDef");
        console.log(res.recordset[0].ViewDef);
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
