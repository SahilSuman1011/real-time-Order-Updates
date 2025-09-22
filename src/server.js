const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import our modules
const { testConnection, closePool } = require('./config/database');
const DatabaseListener = require('./services/dbListener');
const WebSocketHandler = require('./services/websocketHandler');
const ordersRoutes = require('./routes/orders');

class RealtimeOrderServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.port = process.env.PORT || 3000;
        
        // Initialize services
        this.dbListener = null;
        this.wsHandler = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupServices();
        this.setupErrorHandlers();
        this.setupGracefulShutdown();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"]
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' ? false : true,
            credentials: true
        }));

        // Logging
        if (process.env.NODE_ENV !== 'test') {
            this.app.use(morgan('combined'));
        }

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Static files
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        // API Routes
        this.app.use('/api/orders', ordersRoutes);

        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            const dbStatus = await testConnection();
            const wsStats = this.wsHandler ? this.wsHandler.getStats() : null;
            const dbListenerStatus = this.dbListener ? this.dbListener.getStatus() : null;

            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                database: {
                    connected: dbStatus,
                    listener: dbListenerStatus
                },
                websocket: {
                    connected: wsStats ? wsStats.connectedClients : 0,
                    stats: wsStats
                },
                memory: process.memoryUsage(),
                version: process.version
            });
        });

        // API info endpoint
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Real-time Database Updates API',
                version: '1.0.0',
                description: 'WebSocket-based real-time updates for database changes',
                endpoints: {
                    'GET /api/orders': 'Get all orders',
                    'GET /api/orders/:id': 'Get specific order',
                    'POST /api/orders': 'Create new order',
                    'PUT /api/orders/:id': 'Update order',
                    'DELETE /api/orders/:id': 'Delete order',
                    'GET /api/orders/stats': 'Get order statistics',
                    'PATCH /api/orders/bulk-status': 'Bulk update order status'
                },
                websocket: {
                    events: {
                        'orders:insert': 'New order created',
                        'orders:update': 'Order updated',
                        'orders:delete': 'Order deleted'
                    }
                }
            });
        });

        // Serve the web client
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // 404 handler - place this at the very end
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                message: `Cannot ${req.method} ${req.originalUrl}`
            });
        });
    }

    async setupServices() {
        try {
            // Test database connection first
            const dbConnected = await testConnection();
            if (!dbConnected) {
                throw new Error('Database connection failed');
            }

            // Initialize WebSocket handler
            this.wsHandler = new WebSocketHandler(this.server);
            console.log('🔌 WebSocket handler initialized');

            // Initialize database listener
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'realtime_orders',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || ''
            };

            this.dbListener = new DatabaseListener(dbConfig);
            
            // Connect database listener and set up event handling
            await this.dbListener.connect();
            
            // Forward database changes to WebSocket handler
            this.dbListener.on('dataChange', (changeData) => {
                if (this.wsHandler) {
                    this.wsHandler.handleDatabaseChange(changeData);
                }
            });

            // Handle database listener errors
            this.dbListener.on('maxReconnectAttemptsReached', () => {
                console.error('❌ Database listener failed permanently. Server shutting down...');
                this.shutdown();
            });

            console.log('✅ All services initialized successfully');

        } catch (err) {
            console.error('❌ Failed to initialize services:', err);
            process.exit(1);
        }
    }

    setupErrorHandlers() {
        // Express error handler
        this.app.use((err, req, res, next) => {
            console.error('Express error:', err);
            
            res.status(err.status || 500).json({
                success: false,
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });

        // Process error handlers
        process.on('uncaughtException', (err) => {
            console.error('Uncaught exception:', err);
            this.shutdown();
        });

        process.on('unhandledRejection', (err) => {
            console.error('Unhandled rejection:', err);
            this.shutdown();
        });
    }

    setupGracefulShutdown() {
        const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
        
        signals.forEach(signal => {
            process.on(signal, () => {
                console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
                this.shutdown();
            });
        });
    }

    async start() {
        try {
            this.server.listen(this.port, () => {
                console.log(`\n🚀 Server running on port ${this.port}`);
                console.log(`📱 Web client: http://localhost:${this.port}`);
                console.log(`🔧 API docs: http://localhost:${this.port}/api`);
                console.log(`❤️  Health check: http://localhost:${this.port}/health`);
                console.log(`\n📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            });
        } catch (err) {
            console.error('❌ Failed to start server:', err);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('🔄 Shutting down server...');
        
        try {
            // Close WebSocket connections
            if (this.wsHandler) {
                await this.wsHandler.shutdown();
            }

            // Close database listener
            if (this.dbListener) {
                await this.dbListener.disconnect();
            }

            // Close database pool
            await closePool();

            // Close HTTP server
            this.server.close(() => {
                console.log('✅ Server shutdown complete');
                process.exit(0);
            });

            // Force exit after 10 seconds
            setTimeout(() => {
                console.log('⏰ Force shutdown after timeout');
                process.exit(1);
            }, 10000);

        } catch (err) {
            console.error('❌ Error during shutdown:', err);
            process.exit(1);
        }
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new RealtimeOrderServer();
    server.start();
}

module.exports = RealtimeOrderServer;