const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'realtime_orders',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    // Connection pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Connection event handlers
pool.on('connect', (client) => {
    console.log('New database client connected');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle database client:', err);
});

pool.on('remove', (client) => {
    console.log('Database client removed from pool');
});

// Test database connection
async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        console.log('✅ Database connected successfully');
        console.log('📅 Current time:', result.rows[0].current_time);
        console.log('🔧 PostgreSQL version:', result.rows[0].version.split(',')[0]);
        client.release();
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        return false;
    }
}

// Graceful shutdown
async function closePool() {
    try {
        await pool.end();
        console.log('📊 Database pool closed');
    } catch (err) {
        console.error('Error closing database pool:', err);
    }
}

module.exports = {
    pool,
    testConnection,
    closePool
};