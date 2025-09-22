const io = require('socket.io-client');
const readline = require('readline');

class CLIClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.setupEventHandlers();
        this.connect();
    }

    connect() {
        console.log('🔄 Connecting to real-time order system...');
        
        this.socket = io('http://localhost:3001', {
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('✅ Connected to server!');
            console.log('📡 Listening for real-time database updates...\n');
            this.showMenu();
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('❌ Disconnected from server');
        });

        this.socket.on('connect_error', (error) => {
            console.log('❌ Connection error:', error.message);
            console.log('Make sure the server is running on http://localhost:3001');
            process.exit(1);
        });

        this.socket.on('welcome', (data) => {
            console.log(`👋 Welcome! Client ID: ${data.clientId}`);
            console.log(`👥 Total connected clients: ${data.totalClients}\n`);
        });

        // Database change listeners
        this.socket.on('orders:insert', (data) => {
            this.handleDatabaseChange('🆕 INSERT', data, '💚');
        });

        this.socket.on('orders:update', (data) => {
            this.handleDatabaseChange('📝 UPDATE', data, '💛');
        });

        this.socket.on('orders:delete', (data) => {
            this.handleDatabaseChange('🗑️  DELETE', data, '💔');
        });

        this.socket.on('server_shutdown', (data) => {
            console.log('\n🛑 Server is shutting down:', data.message);
            this.disconnect();
        });
    }

    handleDatabaseChange(operation, data, emoji) {
        const timestamp = new Date().toLocaleTimeString();
        const order = data.data;
        
        console.log(`\n${emoji} [${timestamp}] ${operation}`);
        console.log('┌─────────────────────────────────────');
        console.log(`│ Order ID: #${order.id}`);
        console.log(`│ Customer: ${order.customer_name}`);
        console.log(`│ Product: ${order.product_name}`);
        console.log(`│ Status: ${order.status.toUpperCase()}`);
        console.log(`│ Updated: ${new Date(order.updated_at).toLocaleString()}`);
        console.log('└─────────────────────────────────────');
        
        // Show prompt again
        if (this.connected) {
            this.rl.prompt();
        }
    }

    setupEventHandlers() {
        this.rl.on('line', (input) => {
            const command = input.trim().toLowerCase();
            this.handleCommand(command);
        });

        this.rl.on('close', () => {
            this.disconnect();
        });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            console.log('\n👋 Goodbye!');
            this.disconnect();
        });
    }

    handleCommand(command) {
        switch (command) {
            case 'help':
            case 'h':
                this.showHelp();
                break;
            case 'status':
            case 's':
                this.showStatus();
                break;
            case 'orders':
            case 'o':
                this.fetchOrders();
                break;
            case 'create':
            case 'c':
                this.createOrderInteractive();
                break;
            case 'random':
            case 'r':
                this.createRandomOrder();
                break;
            case 'menu':
            case 'm':
                this.showMenu();
                break;
            case 'quit':
            case 'exit':
            case 'q':
                this.disconnect();
                break;
            case 'clear':
                console.clear();
                this.showMenu();
                break;
            default:
                if (command) {
                    console.log(`❌ Unknown command: ${command}`);
                    console.log('💡 Type "help" for available commands');
                }
                this.rl.prompt();
        }
    }

    showMenu() {
        console.log('╔══════════════════════════════════════╗');
        console.log('║        🚀 CLI ORDER CLIENT           ║');
        console.log('╠══════════════════════════════════════╣');
        console.log('║ Commands:                            ║');
        console.log('║ • help (h)   - Show help             ║');
        console.log('║ • status (s) - Connection status     ║');
        console.log('║ • orders (o) - List all orders       ║');
        console.log('║ • create (c) - Create new order      ║');
        console.log('║ • random (r) - Create random order   ║');
        console.log('║ • clear      - Clear screen          ║');
        console.log('║ • quit (q)   - Exit application      ║');
        console.log('╚══════════════════════════════════════╝');
        console.log('');
        this.rl.setPrompt('🎯 Command: ');
        this.rl.prompt();
    }

    showHelp() {
        console.log('\n📖 HELP - Available Commands:');
        console.log('──────────────────────────────');
        console.log('help, h      Show this help message');
        console.log('status, s    Show connection status');
        console.log('orders, o    Fetch and display all orders');
        console.log('create, c    Create a new order interactively');
        console.log('random, r    Create a random order for testing');
        console.log('clear        Clear the screen');
        console.log('menu, m      Show the main menu');
        console.log('quit, q      Exit the application');
        console.log('');
        console.log('💡 This client listens for real-time database changes');
        console.log('   and will display notifications when orders are');
        console.log('   created, updated, or deleted from any source.\n');
        
        this.rl.prompt();
    }

    showStatus() {
        const status = this.connected ? '🟢 Connected' : '🔴 Disconnected';
        console.log(`\n📊 Connection Status: ${status}`);
        console.log(`🔗 Server URL: http://localhost:3001`);
        console.log(`⏰ Uptime: ${Math.floor(process.uptime())} seconds`);
        
        if (this.socket) {
            console.log(`🆔 Socket ID: ${this.socket.id || 'N/A'}`);
            console.log(`🚦 Transport: ${this.socket.io.engine.transport.name || 'N/A'}`);
        }
        
        console.log('');
        this.rl.prompt();
    }

    async fetchOrders() {
        try {
            console.log('📡 Fetching orders...');
            
            const response = await fetch('http://localhost:3001/api/orders');
            const result = await response.json();
            
            if (result.success) {
                console.log(`\n📦 Orders (${result.data.length} total):`);
                console.log('════════════════════════════════════════');
                
                if (result.data.length === 0) {
                    console.log('No orders found.');
                } else {
                    result.data.forEach((order, index) => {
                        const status = order.status.toUpperCase();
                        const statusEmoji = {
                            'PENDING': '⏳',
                            'SHIPPED': '🚚',
                            'DELIVERED': '✅'
                        }[status] || '❓';
                        
                        console.log(`${index + 1}. ${statusEmoji} Order #${order.id}`);
                        console.log(`   👤 ${order.customer_name}`);
                        console.log(`   📦 ${order.product_name}`);
                        console.log(`   📅 ${new Date(order.updated_at).toLocaleString()}`);
                        console.log('');
                    });
                }
            } else {
                console.log('❌ Failed to fetch orders:', result.error);
            }
        } catch (error) {
            console.log('❌ Error fetching orders:', error.message);
        }
        
        console.log('');
        this.rl.prompt();
    }

    createOrderInteractive() {
        console.log('\n📝 Creating new order...');
        
        this.rl.question('👤 Customer name: ', (customerName) => {
            if (!customerName.trim()) {
                console.log('❌ Customer name is required');
                this.rl.prompt();
                return;
            }
            
            this.rl.question('📦 Product name: ', (productName) => {
                if (!productName.trim()) {
                    console.log('❌ Product name is required');
                    this.rl.prompt();
                    return;
                }
                
                this.rl.question('📋 Status (pending/shipped/delivered) [pending]: ', (status) => {
                    const orderStatus = status.trim().toLowerCase() || 'pending';
                    
                    if (!['pending', 'shipped', 'delivered'].includes(orderStatus)) {
                        console.log('❌ Invalid status. Must be: pending, shipped, or delivered');
                        this.rl.prompt();
                        return;
                    }
                    
                    this.createOrder({
                        customer_name: customerName.trim(),
                        product_name: productName.trim(),
                        status: orderStatus
                    });
                });
            });
        });
    }

    createRandomOrder() {
        const customers = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'];
        const products = ['Laptop Pro', 'Wireless Mouse', 'Keyboard', 'Monitor', 'Tablet'];
        const statuses = ['pending', 'shipped', 'delivered'];
        
        const order = {
            customer_name: customers[Math.floor(Math.random() * customers.length)],
            product_name: products[Math.floor(Math.random() * products.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)]
        };
        
        console.log('🎲 Creating random order...');
        this.createOrder(order);
    }

    async createOrder(orderData) {
        try {
            const response = await fetch('http://localhost:3001/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Order created successfully!');
                console.log(`📋 Order #${result.data.id} - ${result.data.customer_name}`);
            } else {
                console.log('❌ Failed to create order:', result.error);
            }
        } catch (error) {
            console.log('❌ Error creating order:', error.message);
        }
        
        console.log('');
        this.rl.prompt();
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.rl.close();
        console.log('👋 CLI client disconnected');
        process.exit(0);
    }
}

// Check if fetch is available (Node.js 18+)
if (!global.fetch) {
    try {
        // For older Node.js versions, try to require node-fetch
        global.fetch = require('node-fetch');
    } catch (err) {
        console.log('❌ Error: fetch not available. Please use Node.js 18+ or install node-fetch');
        process.exit(1);
    }
}

// Start the CLI client
console.log('🚀 Starting CLI client for Real-time Order System...\n');
new CLIClient();