const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.TPV_DB_USER || 'sa',
    password: process.env.TPV_DB_PASSWORD || 'Olam123.',
    server: '10.20.10.150',
    database: 'TPV',
    options: {
        encrypt: false, // para dev
        trustServerCertificate: true
    }
};

async function check() {
    try {
        let pool = await sql.connect(config);
        
        let result = await pool.request()
            .query(`
                SELECT TOP 1 [FSShiftID]
                FROM [vw_POS_Sales_With_Turnos]
                WHERE [FSShiftID] IS NOT NULL
                ORDER BY [DateOfTransaction] DESC, [TimeOfTransaction] DESC
            `);
            
        let shiftId = result.recordset[0]?.FSShiftID;
        console.log('Testing with ShiftID:', shiftId);
        
        if (shiftId) {
            let summary = await pool.request()
                .input('shiftId', sql.VarChar, shiftId)
                .query(`
                    SELECT 
                        [Document Type],
                        COUNT(*) as count,
                        SUM([Amount Including VAT]) as totalGross,
                        SUM([Line Discount Amount]) as totalDiscount,
                        SUM([Quantity]) as totalQuantity
                    FROM [vw_POS_Sales_With_Turnos]
                    WHERE [FSShiftID] = @shiftId
                    GROUP BY [Document Type]
                `);
            console.dir(summary.recordset);
        }
        
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
