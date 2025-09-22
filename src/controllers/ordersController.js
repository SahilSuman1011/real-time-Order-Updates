const { pool } = require('../config/database');

class OrdersController {
    // Get all orders with optional filtering
    async getAllOrders(req, res) {
        try {
            const { status, limit = 50, offset = 0, customer_name } = req.query;
            
            let query = 'SELECT * FROM orders';
            let params = [];
            let whereConditions = [];
            let paramIndex = 1;

            // Add filtering conditions
            if (status) {
                whereConditions.push(`status = $${paramIndex++}`);
                params.push(status);
            }

            if (customer_name) {
                whereConditions.push(`customer_name ILIKE $${paramIndex++}`);
                params.push(`%${customer_name}%`);
            }

            if (whereConditions.length > 0) {
                query += ' WHERE ' + whereConditions.join(' AND ');
            }

            // Add ordering and pagination
            query += ` ORDER BY updated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
            params.push(parseInt(limit), parseInt(offset));

            const result = await pool.query(query, params);
            
            res.json({
                success: true,
                data: result.rows,
                count: result.rows.length,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        } catch (err) {
            console.error('Error fetching orders:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch orders',
                message: err.message
            });
        }
    }

    // Get a specific order by ID
    async getOrderById(req, res) {
        try {
            const { id } = req.params;
            
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid order ID'
                });
            }

            const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (err) {
            console.error('Error fetching order:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch order',
                message: err.message
            });
        }
    }

    // Create a new order
    async createOrder(req, res) {
        try {
            const { customer_name, product_name, status = 'pending' } = req.body;

            // Validation
            if (!customer_name || !product_name) {
                return res.status(400).json({
                    success: false,
                    error: 'customer_name and product_name are required'
                });
            }

            if (!['pending', 'shipped', 'delivered'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'status must be one of: pending, shipped, delivered'
                });
            }

            const query = `
                INSERT INTO orders (customer_name, product_name, status)
                VALUES ($1, $2, $3)
                RETURNING *
            `;

            const result = await pool.query(query, [customer_name, product_name, status]);
            
            console.log('✅ Order created:', result.rows[0]);
            
            res.status(201).json({
                success: true,
                data: result.rows[0],
                message: 'Order created successfully'
            });
        } catch (err) {
            console.error('Error creating order:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to create order',
                message: err.message
            });
        }
    }

    // Update an existing order
    async updateOrder(req, res) {
        try {
            const { id } = req.params;
            const { customer_name, product_name, status } = req.body;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid order ID'
                });
            }

            // Check if order exists
            const existingOrder = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
            if (existingOrder.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            // Validate status if provided
            if (status && !['pending', 'shipped', 'delivered'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'status must be one of: pending, shipped, delivered'
                });
            }

            // Build dynamic update query
            let updateFields = [];
            let params = [];
            let paramIndex = 1;

            if (customer_name !== undefined) {
                updateFields.push(`customer_name = $${paramIndex++}`);
                params.push(customer_name);
            }

            if (product_name !== undefined) {
                updateFields.push(`product_name = $${paramIndex++}`);
                params.push(product_name);
            }

            if (status !== undefined) {
                updateFields.push(`status = $${paramIndex++}`);
                params.push(status);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No fields to update'
                });
            }

            params.push(id);
            const query = `
                UPDATE orders 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await pool.query(query, params);
            
            console.log('📝 Order updated:', result.rows[0]);
            
            res.json({
                success: true,
                data: result.rows[0],
                message: 'Order updated successfully'
            });
        } catch (err) {
            console.error('Error updating order:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to update order',
                message: err.message
            });
        }
    }

    // Delete an order
    async deleteOrder(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid order ID'
                });
            }

            const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            console.log('🗑️ Order deleted:', result.rows[0]);
            
            res.json({
                success: true,
                data: result.rows[0],
                message: 'Order deleted successfully'
            });
        } catch (err) {
            console.error('Error deleting order:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to delete order',
                message: err.message
            });
        }
    }

    // Get order statistics
    async getOrderStats(req, res) {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
                    COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
                    COUNT(DISTINCT customer_name) as unique_customers,
                    MAX(updated_at) as last_updated
                FROM orders
            `;

            const result = await pool.query(statsQuery);
            
            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (err) {
            console.error('Error fetching order statistics:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch order statistics',
                message: err.message
            });
        }
    }

    // Bulk update order statuses
    async bulkUpdateStatus(req, res) {
        try {
            const { order_ids, status } = req.body;

            if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'order_ids must be a non-empty array'
                });
            }

            if (!status || !['pending', 'shipped', 'delivered'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'status must be one of: pending, shipped, delivered'
                });
            }

            const placeholders = order_ids.map((_, index) => `$${index + 1}`).join(',');
            const params = [...order_ids, status];

            const query = `
                UPDATE orders 
                SET status = $${order_ids.length + 1}
                WHERE id IN (${placeholders})
                RETURNING *
            `;

            const result = await pool.query(query, params);
            
            console.log(`📦 Bulk updated ${result.rows.length} orders to status: ${status}`);
            
            res.json({
                success: true,
                data: result.rows,
                updated_count: result.rows.length,
                message: `Successfully updated ${result.rows.length} orders`
            });
        } catch (err) {
            console.error('Error bulk updating orders:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to bulk update orders',
                message: err.message
            });
        }
    }

    // Advanced filtering and search
    async searchOrders(req, res) {
        try {
            const { 
                search, 
                status, 
                date_from, 
                date_to, 
                limit = 20, 
                offset = 0,
                sort_by = 'updated_at',
                sort_order = 'DESC'
            } = req.query;

            let query = 'SELECT * FROM orders WHERE 1=1';
            let params = [];
            let paramIndex = 1;

            // Search functionality
            if (search) {
                query += ` AND (customer_name ILIKE $${paramIndex} OR product_name ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            // Status filter
            if (status && ['pending', 'shipped', 'delivered'].includes(status)) {
                query += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            // Date range filter
            if (date_from) {
                query += ` AND updated_at >= $${paramIndex}`;
                params.push(date_from);
                paramIndex++;
            }

            if (date_to) {
                query += ` AND updated_at <= $${paramIndex}`;
                params.push(date_to);
                paramIndex++;
            }

            // Sorting
            const validSortFields = ['id', 'customer_name', 'product_name', 'status', 'updated_at'];
            const sortField = validSortFields.includes(sort_by) ? sort_by : 'updated_at';
            const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
            
            query += ` ORDER BY ${sortField} ${sortDirection}`;

            // Pagination
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), parseInt(offset));

            const result = await pool.query(query, params);

            // Get total count for pagination
            let countQuery = 'SELECT COUNT(*) FROM orders WHERE 1=1';
            let countParams = [];
            let countParamIndex = 1;

            if (search) {
                countQuery += ` AND (customer_name ILIKE $${countParamIndex} OR product_name ILIKE $${countParamIndex})`;
                countParams.push(`%${search}%`);
                countParamIndex++;
            }

            if (status && ['pending', 'shipped', 'delivered'].includes(status)) {
                countQuery += ` AND status = $${countParamIndex}`;
                countParams.push(status);
                countParamIndex++;
            }

            if (date_from) {
                countQuery += ` AND updated_at >= $${countParamIndex}`;
                countParams.push(date_from);
                countParamIndex++;
            }

            if (date_to) {
                countQuery += ` AND updated_at <= $${countParamIndex}`;
                countParams.push(date_to);
            }

            const countResult = await pool.query(countQuery, countParams);
            const totalCount = parseInt(countResult.rows[0].count);

            res.json({
                success: true,
                data: result.rows,
                pagination: {
                    total: totalCount,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    pages: Math.ceil(totalCount / parseInt(limit)),
                    current_page: Math.floor(parseInt(offset) / parseInt(limit)) + 1
                },
                filters: {
                    search,
                    status,
                    date_from,
                    date_to,
                    sort_by: sortField,
                    sort_order: sortDirection
                }
            });
        } catch (err) {
            console.error('Error searching orders:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to search orders',
                message: err.message
            });
        }
    }

    // Get orders by customer
    async getOrdersByCustomer(req, res) {
        try {
            const { customer_name } = req.params;

            if (!customer_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer name is required'
                });
            }

            const result = await pool.query(
                'SELECT * FROM orders WHERE customer_name ILIKE $1 ORDER BY updated_at DESC',
                [`%${customer_name}%`]
            );

            res.json({
                success: true,
                data: result.rows,
                customer: customer_name,
                count: result.rows.length
            });
        } catch (err) {
            console.error('Error fetching orders by customer:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch orders by customer',
                message: err.message
            });
        }
    }

    // Get recent orders (last 24 hours)
    async getRecentOrders(req, res) {
        try {
            const { hours = 24 } = req.query;

            const result = await pool.query(`
                SELECT * FROM orders 
                WHERE updated_at >= NOW() - INTERVAL '${parseInt(hours)} hours'
                ORDER BY updated_at DESC
            `);

            res.json({
                success: true,
                data: result.rows,
                timeframe: `${hours} hours`,
                count: result.rows.length
            });
        } catch (err) {
            console.error('Error fetching recent orders:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch recent orders',
                message: err.message
            });
        }
    }

    // Export orders to CSV format
    async exportOrders(req, res) {
        try {
            const { format = 'json' } = req.query;
            
            const result = await pool.query('SELECT * FROM orders ORDER BY updated_at DESC');
            
            if (format === 'csv') {
                // Convert to CSV format
                const headers = ['ID', 'Customer Name', 'Product Name', 'Status', 'Updated At'];
                const csvRows = [headers.join(',')];
                
                result.rows.forEach(row => {
                    const csvRow = [
                        row.id,
                        `"${row.customer_name}"`,
                        `"${row.product_name}"`,
                        row.status,
                        row.updated_at.toISOString()
                    ].join(',');
                    csvRows.push(csvRow);
                });
                
                const csvContent = csvRows.join('\n');
                
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=orders_export.csv');
                res.send(csvContent);
            } else {
                // Default JSON format
                res.json({
                    success: true,
                    data: result.rows,
                    exported_at: new Date().toISOString(),
                    count: result.rows.length
                });
            }
        } catch (err) {
            console.error('Error exporting orders:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to export orders',
                message: err.message
            });
        }
    }

    // Get order analytics
    async getOrderAnalytics(req, res) {
        try {
            const analyticsQuery = `
                SELECT 
                    -- Status distribution
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_count,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
                    
                    -- Percentages
                    ROUND(COUNT(CASE WHEN status = 'pending' THEN 1 END) * 100.0 / COUNT(*), 2) as pending_percentage,
                    ROUND(COUNT(CASE WHEN status = 'shipped' THEN 1 END) * 100.0 / COUNT(*), 2) as shipped_percentage,
                    ROUND(COUNT(CASE WHEN status = 'delivered' THEN 1 END) * 100.0 / COUNT(*), 2) as delivered_percentage,
                    
                    -- Time analytics
                    MAX(updated_at) as latest_order,
                    MIN(updated_at) as earliest_order,
                    COUNT(DISTINCT customer_name) as unique_customers,
                    
                    -- Today's orders
                    COUNT(CASE WHEN DATE(updated_at) = CURRENT_DATE THEN 1 END) as orders_today,
                    
                    -- This week's orders
                    COUNT(CASE WHEN updated_at >= date_trunc('week', CURRENT_DATE) THEN 1 END) as orders_this_week
                FROM orders
            `;

            const topCustomersQuery = `
                SELECT 
                    customer_name,
                    COUNT(*) as order_count,
                    ARRAY_AGG(DISTINCT status) as statuses
                FROM orders 
                GROUP BY customer_name 
                ORDER BY order_count DESC 
                LIMIT 5
            `;

            const topProductsQuery = `
                SELECT 
                    product_name,
                    COUNT(*) as order_count,
                    MODE() WITHIN GROUP (ORDER BY status) as most_common_status
                FROM orders 
                GROUP BY product_name 
                ORDER BY order_count DESC 
                LIMIT 5
            `;

            const dailyTrendQuery = `
                SELECT 
                    DATE(updated_at) as date,
                    COUNT(*) as orders_count,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered
                FROM orders 
                WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY DATE(updated_at)
                ORDER BY date DESC
            `;

            const [analytics, topCustomers, topProducts, dailyTrend] = await Promise.all([
                pool.query(analyticsQuery),
                pool.query(topCustomersQuery),
                pool.query(topProductsQuery),
                pool.query(dailyTrendQuery)
            ]);

            res.json({
                success: true,
                data: {
                    overview: analytics.rows[0],
                    top_customers: topCustomers.rows,
                    top_products: topProducts.rows,
                    daily_trend: dailyTrend.rows
                },
                generated_at: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error fetching order analytics:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch order analytics',
                message: err.message
            });
        }
    }
}

module.exports = new OrdersController();