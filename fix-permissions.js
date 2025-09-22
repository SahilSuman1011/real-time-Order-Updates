const { Pool } = require('pg');
require('dotenv').config();

async function fixPermissions() {
    // Connect as postgres superuser
    const adminPool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: 'postgres',  // Use postgres superuser
        password: 'Sahil@123'  // Assuming same password, adjust if different
    });

    try {
        const client = await adminPool.connect();
        
        console.log('🔧 Fixing database permissions...');
        
        // Check if orders table exists
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'orders'
        `);
        
        if (tableCheck.rows.length === 0) {
            console.log('📋 Creating orders table...');
            await client.query(`
                CREATE TABLE orders (
                    id SERIAL PRIMARY KEY,
                    customer_name VARCHAR(100) NOT NULL,
                    product VARCHAR(100) NOT NULL,
                    quantity INTEGER NOT NULL,
                    price DECIMAL(10,2) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Insert some sample data
            await client.query(`
                INSERT INTO orders (customer_name, product, quantity, price, status) VALUES
                ('John Doe', 'Laptop', 1, 999.99, 'completed'),
                ('Jane Smith', 'Phone', 2, 599.99, 'pending'),
                ('Bob Johnson', 'Tablet', 1, 299.99, 'processing')
            `);
            
            console.log('✅ Orders table created with sample data');
        } else {
            console.log('✅ Orders table already exists');
        }
        
        // Grant permissions to realtime_user
        console.log('🔑 Granting permissions to realtime_user...');
        
        // Grant all privileges on the orders table
        await client.query('GRANT ALL PRIVILEGES ON TABLE orders TO realtime_user');
        
        // Grant usage on the sequence (for SERIAL columns)
        await client.query('GRANT USAGE, SELECT ON SEQUENCE orders_id_seq TO realtime_user');
        
        // Grant connect privilege on database
        await client.query('GRANT CONNECT ON DATABASE realtime_orders TO realtime_user');
        
        // Grant usage on schema
        await client.query('GRANT USAGE ON SCHEMA public TO realtime_user');
        
        console.log('✅ Permissions granted successfully!');
        
        client.release();
        await adminPool.end();
        
    } catch (err) {
        console.error('❌ Error fixing permissions:', err.message);
        console.log('\n💡 Possible solutions:');
        console.log('1. Make sure PostgreSQL is running');
        console.log('2. Check if postgres user password is correct');
        console.log('3. Verify database "realtime_orders" exists');
        console.log('4. Try running: createdb -U postgres realtime_orders');
    }
}

fixPermissions();