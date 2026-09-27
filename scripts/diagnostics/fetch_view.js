const sql = require('mssql');
async function getDefinition() {
    const config = {
        user: 'sa',
        password: 'astro',
        server: '209.126.85.139',
        database: 'TPV',
        port: 1433,
        options: { encrypt: false, trustServerCertificate: true }
    };
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT OBJECT_DEFINITION(OBJECT_ID('vw_POS_Sales_With_Turnos')) AS ViewDefinition");
    console.log(result.recordset[0].ViewDefinition);
    await pool.close();
}
getDefinition();
