const mssql = require('mssql');

async function test() {
    const config = {
        server: '192.168.90.60',
        port: undefined,
        user: 'sa',
        password: 'password',
        database: 'test',
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    try {
        console.log('Testing with port undefined...');
        // No real connection needed, just pool creation might trigger it if mssql does some validation
        const pool = new mssql.ConnectionPool(config);
        console.log('Pool created successfully');
    } catch (e) {
        console.error('Error with undefined:', e.message);
    }

    try {
        console.log('Testing with port NaN...');
        const configNaN = { ...config, port: NaN };
        const pool = new mssql.ConnectionPool(configNaN);
        console.log('Pool created successfully (NaN)');
    } catch (e) {
        console.error('Error with NaN:', e.message);
    }
    
    try {
        console.log('Testing with port 0...');
        const config0 = { ...config, port: 0 };
        const pool = new mssql.ConnectionPool(config0);
        console.log('Pool created successfully (0)');
    } catch (e) {
        console.error('Error with 0:', e.message);
    }
}

test();
