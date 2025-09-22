const { Pool } = require('pg');
const EventEmitter = require('events');

class DatabaseListener extends EventEmitter {
    constructor(dbConfig) {
        super();
        this.dbConfig = dbConfig;
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
    }

    async connect() {
        try {
            // Create a dedicated client for listening (separate from pool)
            this.client = new Pool({
                ...this.dbConfig,
                max: 1, // Only need one connection for listening
            });

            const listenerClient = await this.client.connect();
            
            // Set up notification listener
            await listenerClient.query('LISTEN orders_change');
            
            // Handle notifications
            listenerClient.on('notification', (msg) => {
                try {
                    const payload = JSON.parse(msg.payload);
                    console.log('📢 Database notification received:', {
                        channel: msg.channel,
                        operation: payload.operation,
                        table: payload.table,
                        id: payload.data.id
                    });
                    
                    // Emit event for the WebSocket handler
                    this.emit('dataChange', payload);
                } catch (err) {
                    console.error('Error parsing notification payload:', err);
                }
            });

            // Handle connection events
            listenerClient.on('error', (err) => {
                console.error('Database listener error:', err);
                this.handleDisconnection();
            });

            listenerClient.on('end', () => {
                console.log('Database listener connection ended');
                this.handleDisconnection();
            });

            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('🔗 Database listener connected and listening for changes');
            
            return listenerClient;
        } catch (err) {
            console.error('Failed to connect database listener:', err);
            this.handleDisconnection();
            throw err;
        }
    }

    handleDisconnection() {
        this.isConnected = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
            
            console.log(`🔄 Attempting to reconnect database listener (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
            
            setTimeout(() => {
                this.connect().catch(err => {
                    console.error('Reconnection attempt failed:', err);
                });
            }, delay);
        } else {
            console.error('❌ Max reconnection attempts reached. Database listener stopped.');
            this.emit('maxReconnectAttemptsReached');
        }
    }

    async disconnect() {
        if (this.client) {
            try {
                await this.client.end();
                this.isConnected = false;
                console.log('Database listener disconnected');
            } catch (err) {
                console.error('Error disconnecting database listener:', err);
            }
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }
}

module.exports = DatabaseListener;