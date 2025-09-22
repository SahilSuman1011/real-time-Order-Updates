const { Server } = require('socket.io');

class WebSocketHandler {
    constructor(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.NODE_ENV === 'production' ? false : "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });

        this.connectedClients = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            const clientInfo = {
                id: socket.id,
                connectedAt: new Date(),
                address: socket.handshake.address,
                userAgent: socket.handshake.headers['user-agent']
            };

            this.connectedClients.set(socket.id, clientInfo);
            
            console.log('🔗 Client connected:', {
                id: socket.id,
                totalClients: this.connectedClients.size,
                address: clientInfo.address
            });

            // Send welcome message with current server stats
            socket.emit('welcome', {
                message: 'Connected to real-time order updates',
                clientId: socket.id,
                connectedAt: clientInfo.connectedAt,
                totalClients: this.connectedClients.size
            });

            // Handle client subscription to specific order updates
            socket.on('subscribe', (data) => {
                const { orderIds, statuses } = data;
                
                if (orderIds && Array.isArray(orderIds)) {
                    orderIds.forEach(id => socket.join(`order_${id}`));
                    console.log(`Client ${socket.id} subscribed to orders:`, orderIds);
                }

                if (statuses && Array.isArray(statuses)) {
                    statuses.forEach(status => socket.join(`status_${status}`));
                    console.log(`Client ${socket.id} subscribed to status updates:`, statuses);
                }
            });

            // Handle client unsubscription
            socket.on('unsubscribe', (data) => {
                const { orderIds, statuses } = data;
                
                if (orderIds && Array.isArray(orderIds)) {
                    orderIds.forEach(id => socket.leave(`order_${id}`));
                }

                if (statuses && Array.isArray(statuses)) {
                    statuses.forEach(status => socket.leave(`status_${status}`));
                }
            });

            // Handle ping for connection health check
            socket.on('ping', (callback) => {
                if (callback) callback({ pong: Date.now() });
            });

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                this.connectedClients.delete(socket.id);
                console.log('🔌 Client disconnected:', {
                    id: socket.id,
                    reason,
                    totalClients: this.connectedClients.size
                });
            });

            // Handle errors
            socket.on('error', (error) => {
                console.error('WebSocket error for client', socket.id, ':', error);
            });
        });

        // Handle server-level errors
        this.io.engine.on('connection_error', (err) => {
            console.error('WebSocket connection error:', err);
        });
    }

    // Broadcast database changes to all connected clients
    handleDatabaseChange(changeData) {
        const { operation, table, data, timestamp } = changeData;
        
        // Create the message to broadcast
        const message = {
            type: 'database_change',
            operation: operation.toLowerCase(),
            table,
            data,
            timestamp: new Date(timestamp * 1000),
            serverTime: new Date()
        };

        console.log('📡 Broadcasting change to clients:', {
            operation: message.operation,
            table: message.table,
            orderId: data.id,
            connectedClients: this.connectedClients.size
        });

        // Broadcast to all clients
        this.io.emit(`orders:${operation.toLowerCase()}`, message);

        // Send targeted updates to subscribers
        if (data.id) {
            this.io.to(`order_${data.id}`).emit(`order_${data.id}:${operation.toLowerCase()}`, message);
        }

        if (data.status) {
            this.io.to(`status_${data.status}`).emit(`status_${data.status}:${operation.toLowerCase()}`, message);
        }

        // Track broadcast metrics
        this.logBroadcastMetrics(message);
    }

    logBroadcastMetrics(message) {
        const metrics = {
            timestamp: new Date(),
            operation: message.operation,
            table: message.table,
            clientCount: this.connectedClients.size,
            orderId: message.data.id
        };

        // In production, you might want to send this to a monitoring service
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 Broadcast metrics:', metrics);
        }
    }

    // Get server statistics
    getStats() {
        const clients = Array.from(this.connectedClients.values());
        
        return {
            connectedClients: this.connectedClients.size,
            clients: clients.map(client => ({
                id: client.id,
                connectedAt: client.connectedAt,
                duration: Date.now() - client.connectedAt.getTime(),
                address: client.address
            })),
            rooms: Object.keys(this.io.sockets.adapter.rooms),
            serverStartTime: process.uptime()
        };
    }

    // Send a message to a specific client
    sendToClient(clientId, event, data) {
        this.io.to(clientId).emit(event, data);
    }

    // Send a message to all clients
    broadcast(event, data) {
        this.io.emit(event, data);
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🔌 Shutting down WebSocket server...');
        
        // Notify all clients about server shutdown
        this.io.emit('server_shutdown', {
            message: 'Server is shutting down',
            timestamp: new Date()
        });

        // Close all connections
        this.io.close();
        console.log('WebSocket server closed');
    }
}

module.exports = WebSocketHandler;