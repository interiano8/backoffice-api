const sql = require('mssql');
require('dotenv').config();

async function getDefinition() {
    const connStr = process.env.TPV_DATABASE_URL;
    if (!connStr) {
        console.error('TPV_DATABASE_URL not found');
        process.exit(1);
    }

    try {
        // Simple regex to parse sqlserver://[user]:[pass]@[server]:[port];database=[db]
        // Actually, let's use the provided connection string directly if mssql supports it
        // Or parse it manually since it's a bit custom in the .env
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
        
        if (result.recordset[0] && result.recordset[0].ViewDefinition) {
            console.log(result.recordset[0].ViewDefinition);
        } else {
            console.log("Definition not found or NULL");
        }
        await pool.close();
    } catch (err) {
        console.error(err.message);
    }
}

getDefinition();
