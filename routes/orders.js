'use strict';

/**
 * Order Routes — /api/orders, /api/track
 *
 * POST   /api/orders              — create new order (public + admin desk)
 * GET    /api/orders              — list all orders (admin)
 * PUT    /api/orders/:id          — update order by Mongo _id (admin)
 * GET    /api/orders/:trackingId  — get single order by tracking ID
 * GET    /api/track/:trackingId   — alias for public tracking page
 */

const express   = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose  = require('mongoose');
const Order     = require('../models/Order');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a unique CX-XXXXXX tracking ID */
function generateTrackingId() {
    return 'CX-' + Math.floor(100000 + Math.random() * 900000);
}

/** Case-insensitive regex for trackingId lookup */
function trackingRegex(id) {
    return new RegExp(`^${id.trim()}$`, 'i');
}

/** Extracts first validation error and returns 400 */
function handleValidationErrors(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    return null;
}

const VALID_STATUSES = ['Pending', 'Assigned', 'In Transit', 'Delivered', 'Cancelled'];

// ─── POST /api/orders — Create new order ─────────────────────────────────────
router.post(
    '/',
    [
        body('customerName').optional().trim().isLength({ max: 100 }),
        body('pickupAddress').notEmpty().withMessage('Pickup address is required.').trim().isLength({ max: 300 }),
        body('deliveryAddress').optional().trim().isLength({ max: 300 }),
        body('dropoffAddress').optional().trim().isLength({ max: 300 }),
        body('packageDetails').optional().trim().isLength({ max: 500 }),
        body('status').optional().isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
        body('origin').optional().isIn(['customer', 'admin']).withMessage('Origin must be "customer" or "admin".'),
    ],
    async (req, res) => {
        const validationFailed = handleValidationErrors(req, res);
        if (validationFailed) return;

        try {
            const io              = req.app.get('io');
            const telegramAlert   = req.app.get('sendTelegramAlert');
            const trackingId      = req.body.trackingId || generateTrackingId();

            // Normalise field aliases — admin desk uses different field names than client app
            const deliveryAddr =
                req.body.deliveryAddress  ||
                req.body.dropoffAddress   ||
                req.body.destinationPoint ||
                '';

            const orderPayload = {
                trackingId,
                customerName:    (req.body.customerName || req.body.senderName || 'Guest User').trim(),
                pickupAddress:   (req.body.pickupAddress || req.body.collectionPoint || '').trim(),
                deliveryAddress: deliveryAddr.trim(),
                packageDetails:  (req.body.packageDetails || req.body.logisticsType || 'Standard Delivery').trim(),
                status:          req.body.status || 'Pending',
                origin:          req.body.origin || req.body.source || 'customer',
            };

            const newOrder = await new Order(orderPayload).save();

            // Real-time broadcast
            io.emit('newOrderCreated', newOrder);

            // Telegram notification — non-blocking, errors logged internally
            telegramAlert(newOrder);

            console.log(`📦 Order created [${orderPayload.origin}]: ${trackingId}`);
            return res.status(201).json({ message: 'Order created successfully.', trackingId });

        } catch (error) {
            console.error('POST /api/orders error:', error.message);
            return res.status(500).json({ error: 'Failed to create order. Please try again.' });
        }
    }
);

// ─── GET /api/orders — List all orders (admin only) ──────────────────────────
router.get('/', adminAuth, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).lean();
        return res.json(orders);
    } catch (error) {
        console.error('GET /api/orders error:', error.message);
        return res.status(500).json({ error: 'Failed to retrieve orders.' });
    }
});

// ─── PUT /api/orders/:id — Update order by Mongo _id (admin only) ────────────
router.put(
    '/:id',
    adminAuth,
    [
        param('id').custom(v => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid order ID.'),
        body('status').optional().isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
    ],
    async (req, res) => {
        const validationFailed = handleValidationErrors(req, res);
        if (validationFailed) return;

        try {
            const io = req.app.get('io');

            // Whitelist which fields can be updated through this endpoint
            const allowedUpdates = ['status', 'packageDetails', 'riderName', 'riderPhone', 'notes'];
            const updatePayload  = {};
            allowedUpdates.forEach(field => {
                if (req.body[field] !== undefined) updatePayload[field] = req.body[field];
            });
            updatePayload.updatedAt = new Date();

            const updatedOrder = await Order.findByIdAndUpdate(
                req.params.id,
                { $set: updatePayload },
                { new: true, runValidators: true }
            );

            if (!updatedOrder) {
                return res.status(404).json({ error: 'Order not found.' });
            }

            io.emit('orderUpdated', updatedOrder);
            io.to(updatedOrder.trackingId).emit('statusChanged', updatedOrder);

            return res.json(updatedOrder);

        } catch (error) {
            console.error('PUT /api/orders/:id error:', error.message);
            return res.status(500).json({ error: 'Failed to update order.' });
        }
    }
);

// ─── GET /api/orders/:trackingId — Fetch by tracking ID ──────────────────────
router.get('/:trackingId', async (req, res) => {
    try {
        const order = await Order.findOne({
            trackingId: trackingRegex(req.params.trackingId),
        }).lean();

        if (!order) {
            return res.status(404).json({ message: 'Order not found. Check your tracking ID and try again.' });
        }
        return res.json(order);
    } catch (error) {
        console.error('GET /api/orders/:trackingId error:', error.message);
        return res.status(500).json({ error: 'Failed to look up order.' });
    }
});

// ─── GET /api/track/:trackingId — Public tracking alias ──────────────────────
router.get('/track/:trackingId', async (req, res) => {
    try {
        const order = await Order.findOne({
            trackingId: trackingRegex(req.params.trackingId),
        }).lean();

        if (!order) {
            return res.status(404).json({ message: 'Tracking ID not found.' });
        }
        return res.json(order);
    } catch (error) {
        console.error('GET /api/track/:trackingId error:', error.message);
        return res.status(500).json({ error: 'Failed to look up tracking info.' });
    }
});

module.exports = router;