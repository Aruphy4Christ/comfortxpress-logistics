/**
 * ComfortXpress Logistics — Admin Authentication Middleware
 * Validates JSON Web Tokens sent via the Authorization header to protect admin endpoints.
 */

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Extract the Authorization header from the incoming request
    const authHeader = req.headers['authorization'];
    
    // Split the header value ("Bearer <token>") to isolate the token string
    const token = authHeader && authHeader.split(' ')[1]; 

    // Reject the request if no token was attached
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        // Cryptographically verify the token signature against your environment variable
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach the validated token payload payload (e.g., role: 'admin') to the request object
        req.admin = verified; 
        
        // Pass control to the next route handler
        next();
    } catch (err) {
        // Return a 403 Forbidden status if the signature is invalid or token has expired
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};