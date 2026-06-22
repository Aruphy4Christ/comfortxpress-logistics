'use strict';

/**
 * adminAuth middleware
 * Protects admin endpoints by requiring a matching X-Admin-Key header.
 */
function adminAuth(req, res, next) {
    // Check for the header (supports lowercase automatically in Express)
    const key = req.headers['x-admin-key'];

    if (!key) {
        return res.status(401).json({ error: 'Unauthorized: missing API key.' });
    }

    // 💡 FIX: Fallback to ADMIN_SECRET_KEY if ADMIN_API_KEY isn't explicitly used
    const validSecret = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET_KEY;

    if (key !== validSecret) {
        return res.status(403).json({ error: 'Forbidden: invalid API key.' });
    }

    next();
}

module.exports = adminAuth;