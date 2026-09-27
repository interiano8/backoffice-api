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
        const res = await pool.request().query("SELECT DISTINCT [FSShiftID], [Log_Employee], [POS Code] FROM [vw_POS_Sales_With_Turnos] WHERE [fecha_turno] = '2026-03-09' AND [Log_Employee] = 'SJOVEL'");
        console.log("Shifts found:");
        console.table(res.recordset);
        
        if (res.recordset.length > 0) {
            const shiftId = res.recordset[0].FSShiftID;
            console.log(`Analyzing shift: ${shiftId}`);
            
            // Look for non-fuel items in POS Sales Line for this shift
            // We need to link POS Sales Line to this shift. 
            // The view does the join already.
            
            const resDetails = await pool.request().query(`
                SELECT [Description], [No_], [Quantity], [Amount Including VAT], [Pump No_] 
                FROM [vw_POS_Sales_With_Turnos] 
                WHERE [FSShiftID] = '${shiftId}'
            `);
            console.log("Details from view:");
            console.table(resDetails.recordset);
        }

        await pool.close();
    } catch (e) { console.error(e.message); }
}
test();
