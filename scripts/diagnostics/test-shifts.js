const sql = require('mssql');
async function test() {
    const config = {
        user: 'sa',
        password: 'astro',
        server: '192.168.0.248\\PISTA', // Assuming store 012 based on user prompt
        database: 'TPV',
        options: { encrypt: false, trustServerCertificate: true }
    };
    try {
        console.log("Connecting...");
        const pool = await sql.connect(config);
        
        console.log("Querying directly for today...");
        // Check total records for the date
        const res1 = await pool.request().query(`
            SELECT COUNT(*) as count 
            FROM [vw_POS_Sales_With_Turnos] 
            WHERE CAST([fecha_turno] AS DATE) = CAST(GETDATE() AS DATE)
        `);
        console.log("Total sales records for today:", res1.recordset[0].count);

        // Check records with turno_conciliador
        const res2 = await pool.request().query(`
            SELECT COUNT(*) as count 
            FROM [vw_POS_Sales_With_Turnos] 
            WHERE CAST([fecha_turno] AS DATE) = CAST(GETDATE() AS DATE)
            AND [turno_conciliador] IS NOT NULL
        `);
        console.log("Sales records with turno_conciliador for today:", res2.recordset[0].count);

        // Check records with Log_Shift_No
        const res3 = await pool.request().query(`
            SELECT COUNT(*) as count 
            FROM [vw_POS_Sales_With_Turnos] 
            WHERE CAST([fecha_turno] AS DATE) = CAST(GETDATE() AS DATE)
            AND [Log_Shift_No] IS NOT NULL
        `);
        console.log("Sales records with Log_Shift_No for today:", res3.recordset[0].count);

    } catch (e) { console.error(e.message); }
    process.exit(0);
}
test();
