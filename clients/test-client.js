const io = require('socket.io-client');

class TestClient {
    constructor() {
        this.socket = null;
        this.testResults = [];
        this.receivedEvents = [];
        this.startTime = Date.now();
        
        console.log('🧪 Starting Real-time Database Update System Test');
        console.log('=' .repeat(60));
        
        this.runTests();
    }

    async runTests() {
        try {
            await this.testConnection();
            await this.testDatabaseOperations();
            await this.testRealtimeUpdates();
            this.generateReport();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        } finally {
            if (this.socket) {
                this.socket.disconnect();
            }
        }
    }

    async testConnection() {
        console.log('\n🔗 Testing WebSocket Connection...');
        
        return new Promise((resolve, reject) => {
            this.socket = io('http://localhost:3001', {
                transports: ['websocket', 'polling']
            });

            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);

            this.socket.on('connect', () => {
                clearTimeout(timeout);
                console.log('✅ WebSocket connection established');
                this.addResult('Connection Test', true, 'Successfully connected to server');
                
                // Set up event listeners for real-time testing
                this.setupEventListeners();
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                this.addResult('Connection Test', false, `Connection failed: ${error.message}`);
                reject(error);
            });
        });
    }

    setupEventListeners() {
        this.socket.on('welcome', (data) => {
            console.log(`👋 Received welcome message - Client ID: ${data.clientId}`);
            this.receivedEvents.push({ event: 'welcome', data, timestamp: Date.now() });
        });

        this.socket.on('orders:insert', (data) => {
            console.log(`📨 Received INSERT notification for Order #${data.data.id}`);
            this.receivedEvents.push({ event: 'orders:insert', data, timestamp: Date.now() });
        });

        this.socket.on('orders:update', (data) => {
            console.log(`📨 Received UPDATE notification for Order #${data.data.id}`);
            this.receivedEvents.push({ event: 'orders:update', data, timestamp: Date.now() });
        });

        this.socket.on('orders:delete', (data) => {
            console.log(`📨 Received DELETE notification for Order #${data.data.id}`);
            this.receivedEvents.push({ event: 'orders:delete', data, timestamp: Date.now() });
        });
    }

    async testDatabaseOperations() {
        console.log('\n📋 Testing Database Operations...');
        
        try {
            // Test CREATE operation
            const createResult = await this.testCreateOrder();
            
            // Test READ operation
            const readResult = await this.testReadOrders();
            
            // Test UPDATE operation
            const updateResult = await this.testUpdateOrder(createResult.orderId);
            
            // Test DELETE operation
            const deleteResult = await this.testDeleteOrder(createResult.orderId);
            
            console.log('✅ All database operations completed');
            
        } catch (error) {
            console.error('❌ Database operation test failed:', error);
            this.addResult('Database Operations', false, error.message);
        }
    }

    async testCreateOrder() {
        console.log('  📝 Testing CREATE order...');
        
        const orderData = {
            customer_name: 'Test Customer',
            product_name: 'Test Product',
            status: 'pending'
        };

        const response = await fetch('http://localhost:3001/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (result.success) {
            console.log(`     ✅ Order created with ID: ${result.data.id}`);
            this.addResult('Create Order', true, `Created order #${result.data.id}`);
            return { orderId: result.data.id, orderData: result.data };
        } else {
            throw new Error(`Create failed: ${result.error}`);
        }
    }

    async testReadOrders() {
        console.log('  📖 Testing READ orders...');
        
        const response = await fetch('http://localhost:3001/api/orders');
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            console.log(`     ✅ Retrieved ${result.data.length} orders`);
            this.addResult('Read Orders', true, `Retrieved ${result.data.length} orders`);
            return result.data;
        } else {
            throw new Error('Failed to read orders');
        }
    }

    async testUpdateOrder(orderId) {
        console.log(`  📝 Testing UPDATE order #${orderId}...`);
        
        const updateData = { status: 'shipped' };

        const response = await fetch(`http://localhost:3001/api/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (result.success) {
            console.log(`     ✅ Order #${orderId} updated to status: ${result.data.status}`);
            this.addResult('Update Order', true, `Updated order #${orderId} status`);
            return result.data;
        } else {
            throw new Error(`Update failed: ${result.error}`);
        }
    }

    async testDeleteOrder(orderId) {
        console.log(`  🗑️  Testing DELETE order #${orderId}...`);
        
        const response = await fetch(`http://localhost:3001/api/orders/${orderId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            console.log(`     ✅ Order #${orderId} deleted successfully`);
            this.addResult('Delete Order', true, `Deleted order #${orderId}`);
            return result.data;
        } else {
            throw new Error(`Delete failed: ${result.error}`);
        }
    }

    async testRealtimeUpdates() {
        console.log('\n⚡ Testing Real-time Updates...');
        
        // Wait a bit to ensure all events are received
        await this.sleep(2000);
        
        // Check if we received the expected events
        const insertEvents = this.receivedEvents.filter(e => e.event === 'orders:insert');
        const updateEvents = this.receivedEvents.filter(e => e.event === 'orders:update');
        const deleteEvents = this.receivedEvents.filter(e => e.event === 'orders:delete');
        
        console.log(`  📊 Received ${insertEvents.length} INSERT events`);
        console.log(`  📊 Received ${updateEvents.length} UPDATE events`);
        console.log(`  📊 Received ${deleteEvents.length} DELETE events`);
        
        // Verify we received expected events
        const hasInsertEvent = insertEvents.length > 0;
        const hasUpdateEvent = updateEvents.length > 0;
        const hasDeleteEvent = deleteEvents.length > 0;
        
        this.addResult('Real-time INSERT', hasInsertEvent, 
            hasInsertEvent ? 'Received INSERT notification' : 'No INSERT notification received');
        
        this.addResult('Real-time UPDATE', hasUpdateEvent, 
            hasUpdateEvent ? 'Received UPDATE notification' : 'No UPDATE notification received');
        
        this.addResult('Real-time DELETE', hasDeleteEvent, 
            hasDeleteEvent ? 'Received DELETE notification' : 'No DELETE notification received');
        
        // Test event timing (events should arrive within reasonable time)
        const eventTimings = this.receivedEvents.map(e => e.timestamp - this.startTime);
        const avgResponseTime = eventTimings.length > 0 ? 
            Math.round(eventTimings.reduce((a, b) => a + b, 0) / eventTimings.length) : 0;
        
        console.log(`  ⏱️  Average event response time: ${avgResponseTime}ms`);
        
        this.addResult('Event Timing', avgResponseTime < 1000, 
            `Average response time: ${avgResponseTime}ms`);
    }

    async testPerformanceLoad() {
        console.log('\n🚀 Testing Performance Load...');
        
        const startTime = Date.now();
        const promises = [];
        const testCount = 10;
        
        console.log(`  📈 Creating ${testCount} orders concurrently...`);
        
        for (let i = 0; i < testCount; i++) {
            const orderData = {
                customer_name: `Load Test Customer ${i + 1}`,
                product_name: `Load Test Product ${i + 1}`,
                status: 'pending'
            };
            
            promises.push(fetch('http://localhost:3001/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            }));
        }
        
        try {
            const responses = await Promise.all(promises);
            const results = await Promise.all(responses.map(r => r.json()));
            
            const successful = results.filter(r => r.success).length;
            const totalTime = Date.now() - startTime;
            const avgTime = totalTime / testCount;
            
            console.log(`     ✅ ${successful}/${testCount} orders created successfully`);
            console.log(`     ⏱️  Total time: ${totalTime}ms, Average: ${avgTime.toFixed(2)}ms per order`);
            
            this.addResult('Load Test', successful === testCount, 
                `${successful}/${testCount} successful, ${avgTime.toFixed(2)}ms avg`);
            
            // Clean up created orders
            const createdIds = results
                .filter(r => r.success)
                .map(r => r.data.id);
            
            await this.cleanupOrders(createdIds);
            
        } catch (error) {
            this.addResult('Load Test', false, `Load test failed: ${error.message}`);
        }
    }

    async cleanupOrders(orderIds) {
        console.log(`  🧹 Cleaning up ${orderIds.length} test orders...`);
        
        const deletePromises = orderIds.map(id => 
            fetch(`http://localhost:3001/api/orders/${id}`, { method: 'DELETE' })
        );
        
        await Promise.all(deletePromises);
        console.log('     ✅ Cleanup completed');
    }

    async testErrorHandling() {
        console.log('\n🛡️  Testing Error Handling...');
        
        try {
            // Test invalid order creation
            const invalidResponse = await fetch('http://localhost:3001/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // Missing required fields
            });
            
            const invalidResult = await invalidResponse.json();
            
            if (!invalidResult.success && invalidResponse.status === 400) {
                console.log('     ✅ Invalid order creation properly rejected');
                this.addResult('Error Handling - Invalid Data', true, 'Properly rejected invalid order');
            } else {
                this.addResult('Error Handling - Invalid Data', false, 'Did not reject invalid order');
            }
            
            // Test non-existent order access
            const notFoundResponse = await fetch('http://localhost:3001/api/orders/99999');
            const notFoundResult = await notFoundResponse.json();
            
            if (!notFoundResult.success && notFoundResponse.status === 404) {
                console.log('     ✅ Non-existent order properly handled');
                this.addResult('Error Handling - Not Found', true, 'Properly handled non-existent order');
            } else {
                this.addResult('Error Handling - Not Found', false, 'Did not handle non-existent order');
            }
            
        } catch (error) {
            this.addResult('Error Handling', false, `Error handling test failed: ${error.message}`);
        }
    }

    async testHealthEndpoint() {
        console.log('\n🏥 Testing Health Endpoint...');
        
        try {
            const response = await fetch('http://localhost:3001/health');
            const healthData = await response.json();
            
            const hasRequiredFields = healthData.status && 
                                    healthData.database && 
                                    healthData.websocket !== undefined;
            
            if (hasRequiredFields && healthData.status === 'ok') {
                console.log('     ✅ Health endpoint responding correctly');
                console.log(`     📊 Database: ${healthData.database.connected ? 'Connected' : 'Disconnected'}`);
                console.log(`     🔌 WebSocket clients: ${healthData.websocket.connected}`);
                
                this.addResult('Health Endpoint', true, 'Health endpoint working correctly');
            } else {
                this.addResult('Health Endpoint', false, 'Health endpoint missing data');
            }
            
        } catch (error) {
            this.addResult('Health Endpoint', false, `Health endpoint failed: ${error.message}`);
        }
    }

    addResult(testName, passed, details) {
        this.testResults.push({
            testName,
            passed,
            details,
            timestamp: new Date()
        });
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        console.log(`\n📈 Overall Results:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests} ✅`);
        console.log(`   Failed: ${failedTests} ❌`);
        console.log(`   Success Rate: ${successRate}%`);
        
        console.log('\n📋 Detailed Results:');
        console.log('-'.repeat(60));
        
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.testName}`);
            console.log(`   ${result.details}`);
        });
        
        console.log('\n⚡ Real-time Events Summary:');
        console.log('-'.repeat(60));
        console.log(`   Total events received: ${this.receivedEvents.length}`);
        
        const eventTypes = {};
        this.receivedEvents.forEach(event => {
            eventTypes[event.event] = (eventTypes[event.event] || 0) + 1;
        });
        
        Object.entries(eventTypes).forEach(([eventType, count]) => {
            console.log(`   ${eventType}: ${count} events`);
        });
        
        const totalTime = Date.now() - this.startTime;
        console.log(`\n⏱️  Total test duration: ${totalTime}ms`);
        
        // Final assessment
        console.log('\n🎯 Assessment:');
        if (successRate >= 90) {
            console.log('🏆 EXCELLENT: System is working perfectly!');
        } else if (successRate >= 75) {
            console.log('👍 GOOD: System is working well with minor issues');
        } else if (successRate >= 50) {
            console.log('⚠️  FAIR: System has some significant issues');
        } else {
            console.log('❌ POOR: System has major problems that need attention');
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Exit with appropriate code
        process.exit(successRate >= 75 ? 0 : 1);
    }
}

// Check if fetch is available
if (!global.fetch) {
    try {
        global.fetch = require('node-fetch');
    } catch (err) {
        console.log('❌ Error: fetch not available. Please use Node.js 18+ or install node-fetch');
        console.log('   npm install node-fetch');
        process.exit(1);
    }
}

// Run the test suite
new TestClient();