'use strict';

/**
 * Admin Inquiry Routes — /api/admin/inquiries
 * * GET    /api/admin/inquiries            — List all inquiries
 * PUT    /api/admin/inquiries/:id/read   — Mark as read
 * DELETE /api/admin/inquiries/:id        — Delete an inquiry
 */

const express = require('express');
const { param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Helper for validation
const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    return null;
};

// ─── GET / — List all inquiries ──────────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
    try {
        const inquiries = await Inquiry.find().sort({ createdAt: -1 }).lean();
        return res.json(inquiries);
    } catch (error) {
        console.error('Admin GET /inquiries error:', error.message);
        return res.status(500).json({ error: 'Failed to retrieve inquiries.' });
    }
});

// ─── PUT /:id/read — Mark inquiry as read ────────────────────────────────────
router.put(
    '/:id/read',
    adminAuth,
    [
        param('id').custom(v => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid ID format.')
    ],
    async (req, res) => {
        if (handleValidation(req, res)) return;

        try {
            const inquiry = await Inquiry.findByIdAndUpdate(
                req.params.id,
                { $set: { read: true, readAt: new Date() } },
                { new: true }
            );

            if (!inquiry) return res.status(404).json({ error: 'Inquiry not found.' });
            
            return res.json({ message: 'Inquiry marked as read.', inquiry });
        } catch (error) {
            console.error('Admin PUT /read error:', error.message);
            return res.status(500).json({ error: 'Failed to update inquiry.' });
        }
    }
);

// ─── DELETE /:id — Delete inquiry ───────────────────────────────────────────
router.delete(
    '/:id',
    adminAuth,
    [
        param('id').custom(v => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid ID format.')
    ],
    async (req, res) => {
        if (handleValidation(req, res)) return;

        try {
            const inquiry = await Inquiry.findByIdAndDelete(req.params.id);
            if (!inquiry) return res.status(404).json({ error: 'Inquiry not found.' });
            
            return res.json({ message: 'Inquiry deleted successfully.' });
        } catch (error) {
            console.error('Admin DELETE /inquiries error:', error.message);
            return res.status(500).json({ error: 'Failed to delete inquiry.' });
        }
    }
);

module.exports = router;