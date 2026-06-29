/**
 * ComfortXpress Logistics — Main Server
 * Entry point: initialises middleware, database, routes, and WebSocket server.
 */

require('dotenv').config();
const crypto = require('crypto'); // Added for request ID generation

// --- Environment variable guard ---
// ADMIN_SECRET_KEY has been retired in favour of a real login flow (see routes/auth.js).
const REQUIRED_ENV = ['MONGODB_URI', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

const express      = require('express');
const mongoose     = require('mongoose');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const jwt          = require('jsonwebtoken');

const logger        = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const requireAdmin  = require('./middleware/requireAdmin');

// Route modules
const orderRoutes        = require('./routes/orders');
const trackRoutes        = require('./routes/track');
const inquiryRoutes      = require('./routes/inquiries');       // Public
const adminInquiryRoutes = require('./routes/adminInquiries'); // Admin Only
const authRoutes         = require('./routes/auth');           // New: login/logout/me
const Order              = require('./models/Order');

// ─── App & Server Setup ──────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

// Render (and most PaaS hosts) sit behind a reverse proxy. This is required so that
// secure cookies (res.cookie({ secure: true })) are set correctly in production.
app.set('trust proxy', 1);

// --- Request ID Middleware ---
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    // Setting header so you can see it in browser Network tab
    res.setHeader('X-Request-Id', req.id);
    next();
});

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5500'];

const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling']
});

app.set('io', io);

// ─── Security & Middleware ───────────────────────────────────────────────────

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc:  ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
            fontSrc:    ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
            imgSrc:     ["'self'", 'data:'],
            connectSrc: ["'self'", 'wss:', 'ws:']
        }
    }
}));

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Updated static asset delivery with cache control rules
app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true
}));

app.use('/api', apiLimiter);

// ─── Database Connection ──────────────────────────────────────────────────────

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    logger.info('MongoDB Atlas connected successfully.');
})
.catch(err => {
    logger.error('Database connection failed: ' + err.message);
    process.exit(1);
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth',            authRoutes);
app.use('/api/orders',          orderRoutes);
app.use('/api/track',           trackRoutes);
app.use('/api/inquiries',       inquiryRoutes);
app.use('/api/admin/inquiries', requireAdmin, adminInquiryRoutes);

app.get('/api/health', async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: 'degraded', db: 'unreachable', error: err.message });
    }
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
    // You can now include the request ID in your logs!
    logger.error(`[ID: ${req.id}] ${err.stack || err.message}`);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === 'production'
          ? 'Something went wrong'
          : err.message
    });
});

// ─── WebSocket Auth Helpers ───────────────────────────────────────────────────
// Replaces the old "compare a plaintext token sent by the client" approach. The admin
// room and status-update events now require the same signed cx_session cookie used by
// the HTTP admin routes — there is no longer a secret value for the client to leak.

function getCookieValue(cookieHeader, name) {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        const key = part.slice(0, eq).trim();
        if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
    }
    return null;
}

function socketIsAdmin(socket) {
    const token = getCookieValue(socket.handshake.headers.cookie, 'cx_session');
    if (!token) return false;
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        return true;
    } catch {
        return false;
    }
}

// ─── WebSocket Logic ──────────────────────────────────────────────────────────

io.on('connection', (socket) => {
    socket.on('joinTrackingRoom', (trackingId) => {
        if (trackingId) socket.join(trackingId.trim().toUpperCase());
    });

    socket.on('joinAdminRoom', () => {
        if (socketIsAdmin(socket)) {
            socket.join('admin-room');
        }
    });

    socket.on('updateOrderStatus', async ({ trackingId, newStatus }) => {
        if (!socketIsAdmin(socket)) {
            socket.emit('updateError', { message: 'Unauthorized: admin session required.' });
            return;
        }

        try {
            const updatedOrder = await Order.findOneAndUpdate(
                { trackingId: { $regex: new RegExp('^' + trackingId.trim() + '$', 'i') } },
                { status: newStatus },
                { new: true }
            );
            if (updatedOrder) {
                io.to(updatedOrder.trackingId).emit('statusChanged', updatedOrder);
                io.to('admin-room').emit('orderUpdated', updatedOrder);
            } else {
                socket.emit('updateError', { message: 'Order not found.' });
            }
        } catch (err) {
            logger.error('Socket update failed:', err.message);
            socket.emit('updateError', { message: 'Server error during update.' });
        }
    });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT) || 3000;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

async function shutdown() {
    logger.info('Shutting down gracefully...');
    await mongoose.connection.close();
    server.close(() => process.exit(0));
}