const sql = require('mssql');
async function querySales() {
    const config = {
        user: 'sa',
        password: 'astro',
        server: '209.126.85.139',
        database: 'TPV',
        port: 1433,
        options: { encrypt: false, trustServerCertificate: true }
    };
    try {
        const pool = await sql.connect(config);
        const query = `
            SELECT 
                V.[Log_Shift_No] as ShiftNo,
                V.[Log_Employee] as EmployeeUsername,
                V.[turno_conciliador] as ReconcilerShiftId,
                CAST(V.[fecha_turno] AS VARCHAR) as ShiftDate,
                SUM(ISNULL(V.[Amount Including VAT], 0)) as TotalSale
            FROM [vw_POS_Sales_With_Turnos] V
            WHERE CAST(V.[fecha_turno] AS DATE) = '2026-07-14'
                AND V.[Log_Employee] = 'NNUÑEZ'
            GROUP BY V.[Log_Shift_No], V.[Log_Employee], V.[turno_conciliador], V.[fecha_turno]
            ORDER BY V.[Log_Shift_No]
        `;
        const result = await pool.request().query(query);
        console.table(result.recordset);
        await pool.close();
    } catch(err) {
        console.error(err);
    }
}
querySales();
