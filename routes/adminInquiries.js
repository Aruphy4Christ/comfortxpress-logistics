'use strict';

/**
 * Admin Inquiry Routes — /api/admin/inquiries
 * Protected by requireAdmin middleware (applied at mount point in server.js).
 *
 * GET    /              — fetch all inquiries, newest first
 * PATCH  /:id/read      — mark one inquiry as read
 * DELETE /:id           — delete one inquiry
 */

const express = require('express');
const router  = express.Router();
const Inquiry = require('../models/Inquiry');

// ─── GET / — Return all inquiries, sorted newest first ────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const inquiries = await Inquiry.find()
            .sort({ createdAt: -1 })
            .lean();
        res.json(inquiries);
    } catch (err) {
        next(err);
    }
});

// ─── PATCH /:id/read — Mark as read ──────────────────────────────────────────
router.patch('/:id/read', async (req, res, next) => {
    try {
        const doc = await Inquiry.findByIdAndUpdate(
            req.params.id,
            { read: true, readAt: new Date() },
            { new: true }
        );
        if (!doc) return res.status(404).json({ error: 'Inquiry not found.' });
        res.json(doc);
    } catch (err) {
        next(err);
    }
});

// ─── DELETE /:id — Remove inquiry ────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
    try {
        const doc = await Inquiry.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Inquiry not found.' });

        // Notify all admin sockets that an inquiry was removed
        const io = req.app.get('io');
        io.to('admin-room').emit('inquiryDeleted', { id: req.params.id });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;