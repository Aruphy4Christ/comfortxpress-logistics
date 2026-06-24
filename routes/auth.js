'use strict';
/**
 * Auth Routes — /api/auth
 *
 * POST /login   — verify admin credentials server-side, issue a signed httpOnly session cookie
 * POST /logout  — clear the session cookie
 * GET  /me      — check whether the current request has a valid admin session
 *
 * Replaces the old client-side check in login.html (user === "admin" && pass === "comfort2026")
 * and the static ADMIN_SECRET_KEY model. Credentials never appear in any file shipped to the browser.
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const router = express.Router();

const COOKIE_NAME  = 'cx_session';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        if (username !== process.env.ADMIN_USERNAME) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const passwordMatches = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge:   TOKEN_TTL_MS,
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
});

router.get('/me', (req, res) => {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (!token) return res.status(401).json({ authenticated: false });

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        res.json({ authenticated: true });
    } catch {
        res.status(401).json({ authenticated: false });
    }
});

module.exports = router;