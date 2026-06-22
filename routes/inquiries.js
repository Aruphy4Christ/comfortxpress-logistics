'use strict';

/**
 * Inquiry Routes — /api/inquiries
 * * POST /api/inquiries — Public: Submit contact form inquiry
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Inquiry = require('../models/Inquiry');

const router = express.Router();

// ─── POST / — Submit inquiry from public Contact page ─────────────────────────
router.post(
    '/',
    [
        body('fullName')
            .trim()
            .notEmpty().withMessage('Full name is required.')
            .isLength({ max: 100 }).withMessage('Name must be under 100 characters.'),
        body('emailAddress')
            .trim()
            .notEmpty().withMessage('Email address is required.')
            .isEmail().withMessage('Please provide a valid email address.')
            .normalizeEmail(),
        body('msgSubject')
            .trim()
            .notEmpty().withMessage('Subject is required.')
            .isLength({ max: 200 }).withMessage('Subject must be under 200 characters.'),
        body('messageBody')
            .trim()
            .notEmpty().withMessage('Message body is required.')
            .isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        try {
            const io = req.app.get('io');
            const { fullName, emailAddress, msgSubject, messageBody } = req.body;

            const newInquiry = await new Inquiry({
                fullName,
                emailAddress,
                msgSubject,
                messageBody,
            }).save();

            // Emit to admin dashboard
            io.to('admin-room').emit('newInquirySubmitted', newInquiry);

            console.log(`📩 Public inquiry received from: ${fullName}`);
            return res.status(201).json({ 
                message: 'Your message has been received. We will get back to you shortly.' 
            });

        } catch (error) {
            console.error('POST /api/inquiries error:', error.message);
            return res.status(500).json({ error: 'Failed to submit inquiry. Please try again.' });
        }
    }
);

module.exports = router;