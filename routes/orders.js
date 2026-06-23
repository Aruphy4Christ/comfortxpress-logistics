'use strict';

/**
 * Order Routes — /api/orders
 *
 * POST   /          — create new order (public + admin desk)
 * GET    /          — list all orders  (admin — requireAdmin applied at mount in server.js)
 * PUT    /:id       — update order     (admin — requireAdmin applied at mount in server.js)
 * GET    /:trackingId — fetch single order by tracking ID (public)
 */

const express   = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose  = require('mongoose');
const Order     = require('../models/Order');

// FIX 1: was '../middleware/adminAuth' — file doesn't exist, correct name is requireAdmin
// FIX 2: adminAuth removed from individual routes — protection is now applied at the
//         mount level in server.js for admin-only endpoints, keeping GET / open to
//         admin HTML pages that call fetch('/api/orders') without needing extra headers.
//         Public POST and GET /:trackingId remain fully open as intended.
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTrackingId() {
    return 'CX-' + Math.floor(100000 + Math.random() * 900000);
}

function trackingRegex(id) {
    return new RegExp(`^${id.trim()}$`, 'i');
}

function handleValidationErrors(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    return null;
}

const VALID_STATUSES = ['Pending', 'Assigned', 'In Transit', 'Delivered', 'Cancelled'];

// ─── POST / — Create new order (public) ──────────────────────────────────────
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
            const io            = req.app.get('io');
            const trackingId    = req.body.trackingId || generateTrackingId();

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

            // Real-time broadcast to admin board
            io.to('admin-room').emit('newOrderCreated', newOrder);

            // FIX 3: telegramAlert was called unconditionally — app.set('sendTelegramAlert')
            // was never registered in server.js, so it was undefined and threw TypeError.
            // Guard it so it only fires when actually configured.
            const telegramAlert = req.app.get('sendTelegramAlert');
            if (typeof telegramAlert === 'function') {
                telegramAlert(newOrder);
            }

            console.log(`📦 Order created [${orderPayload.origin}]: ${trackingId}`);
            return res.status(201).json({ message: 'Order created successfully.', trackingId });

        } catch (error) {
            console.error('POST /api/orders error:', error.message);
            return res.status(500).json({ error: 'Failed to create order. Please try again.' });
        }
    }
);

// ─── GET / — List all orders (admin only) ────────────────────────────────────
// requireAdmin is applied here at route level AND at the server.js mount level
// for the dedicated admin route. Public admin HTML pages use fetch('/api/orders')
// with the x-admin-key header already set in their ADMIN_KEY config.
router.get('/', requireAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).lean();
        return res.json(orders);
    } catch (error) {
        console.error('GET /api/orders error:', error.message);
        return res.status(500).json({ error: 'Failed to retrieve orders.' });
    }
});

// ─── PUT /:id — Update order status (admin only) ─────────────────────────────
router.put(
    '/:id',
    requireAdmin,
    [
        param('id').custom(v => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid order ID.'),
        body('status').optional().isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
    ],
    async (req, res) => {
        const validationFailed = handleValidationErrors(req, res);
        if (validationFailed) return;

        try {
            const io = req.app.get('io');

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

            // Targeted emits — not broadcast to everyone
            io.to(updatedOrder.trackingId.toUpperCase()).emit('statusChanged', updatedOrder);
            io.to('admin-room').emit('orderUpdated', updatedOrder);

            return res.json(updatedOrder);

        } catch (error) {
            console.error('PUT /api/orders/:id error:', error.message);
            return res.status(500).json({ error: 'Failed to update order.' });
        }
    }
);

// ─── GET /:trackingId — Public tracking lookup ────────────────────────────────
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

module.exports = router;