const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, COUNT(*) as order_count FROM orders');
        
        console.log('✅ Database connection successful!');
        console.log('📅 Current time:', result.rows[0].current_time);
        console.log('📦 Total orders:', result.rows[0].order_count);
        
        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
    }
}

testConnection();