'use strict';
/**
 * requireAdmin — verifies the signed cx_session cookie issued by POST /api/auth/login.
 *
 * Previously compared req.headers['x-admin-key'] / req.query.key against a single static
 * ADMIN_SECRET_KEY value that also lived hardcoded in message.html's source — meaning anyone
 * who viewed the page source had full admin access with no login at all. This version requires
 * a token that can only have been issued by the server after a correct username/password check,
 * and that token can't be forged without JWT_SECRET (which never leaves the server).
 */
const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
    const token = req.cookies ? req.cookies['cx_session'] : null;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};