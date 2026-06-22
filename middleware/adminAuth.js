'use strict';

/**
 * adminAuth middleware
 * Protects admin endpoints by requiring a matching X-Admin-Key header.
 * The key must be set in .env as ADMIN_API_KEY.
 *
 * Usage:
 *   router.get('/inquiries', adminAuth, handler)
 */
function adminAuth(req, res, next) {
    const key = req.headers['x-admin-key'];

    if (!key) {
        return res.status(401).json({ error: 'Unauthorized: missing API key.' });
    }

    if (key !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ error: 'Forbidden: invalid API key.' });
    }

    next();
}

module.exports = adminAuth;