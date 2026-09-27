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
        const res = await pool.request().query("SELECT COUNT(*) as count FROM [HoseFS]");
        console.log("Total hoses in TPV [HoseFS]:", res.recordset[0].count);
        if (res.recordset[0].count > 0) {
            const data = await pool.request().query("SELECT TOP 5 PumpID, HoseID, GradeName, CodigoGenerico FROM [HoseFS]");
            console.log(JSON.stringify(data.recordset, null, 2));
        }
        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
