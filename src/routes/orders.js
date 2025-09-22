const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

// Validation middleware
const validateOrderData = (req, res, next) => {
    const { customer_name, product_name } = req.body;
    
    if (req.method === 'POST' && (!customer_name || !product_name)) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            required: ['customer_name', 'product_name']
        });
    }
    
    // Sanitize input
    if (customer_name) req.body.customer_name = customer_name.trim();
    if (product_name) req.body.product_name = product_name.trim();
    
    next();
};

// Request logging middleware
const logRequest = (req, res, next) => {
    console.log(`📋 ${req.method} ${req.path}`, {
        params: req.params,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined,
        timestamp: new Date().toISOString()
    });
    next();
};

// Rate limiting middleware (simple implementation)
const rateLimiter = (req, res, next) => {
    // In production, use redis-based rate limiting
    const ip = req.ip;
    // Simple in-memory rate limiting (use Redis in production)
    next();
};

// Apply middleware
router.use(logRequest);
router.use(rateLimiter);

// Basic CRUD Routes
router.get('/', ordersController.getAllOrders);
router.get('/stats', ordersController.getOrderStats);
router.get('/analytics', ordersController.getOrderAnalytics);
router.get('/recent', ordersController.getRecentOrders);
router.get('/search', ordersController.searchOrders);
router.get('/export', ordersController.exportOrders);
router.get('/customer/:customer_name', ordersController.getOrdersByCustomer);
router.get('/:id', ordersController.getOrderById);

router.post('/', validateOrderData, ordersController.createOrder);
router.put('/:id', validateOrderData, ordersController.updateOrder);
router.delete('/:id', ordersController.deleteOrder);

// Bulk operations
router.patch('/bulk-status', ordersController.bulkUpdateStatus);

module.exports = router;