'use strict';

/**
 * Track Routes — /api/track
 * * Provides a clean interface for public order tracking.
 */

const express = require('express');
const Order = require('../models/Order');

const router = express.Router();

/** Case-insensitive regex for trackingId lookup */
function trackingRegex(id) {
    return new RegExp(`^${id.trim()}$`, 'i');
}

// ─── GET /api/track/:trackingId ──────────────────────────────────────────────
router.get('/:trackingId', async (req, res) => {
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