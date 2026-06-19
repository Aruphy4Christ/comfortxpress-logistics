require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Order = require('./models/Order'); //[cite: 5]
const Inquiry = require('./models/Inquiry'); //[cite: 5]
const { sendTelegramAlert } = require('./notificationService'); //[cite: 5]

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } }); //[cite: 5]

// Middleware
app.use(cors()); //[cite: 5]
app.use(express.json()); //[cite: 5]
app.use(express.urlencoded({ extended: true })); //[cite: 5]
app.use(express.static('public')); //[cite: 5]

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/comfortxpress') //[cite: 5]
  .then(() => console.log('MongoDB Connected Successfully')) //[cite: 5]
  .catch(err => console.error('Database Error: ', err)); //[cite: 5]

// --- RESTful API ENDPOINTS ---

// Create a new order
app.post('/api/orders', async (req, res) => { //[cite: 5]
    try {
        const trackingId = req.body.trackingId || ('CX-' + Math.floor(100000 + Math.random() * 900000)); //[cite: 5]
        
        const orderPayload = {
            trackingId,
            customerName: req.body.customerName || req.body.senderName || "Guest User", //[cite: 5]
            pickupAddress: req.body.pickupAddress || req.body.collectionPoint || "", //[cite: 5]
            deliveryAddress: req.body.deliveryAddress || req.body.dropoffAddress || req.body.destinationPoint || "", //[cite: 5]
            dropoffAddress: req.body.deliveryAddress || req.body.dropoffAddress || req.body.destinationPoint || "", //[cite: 5]
            packageDetails: req.body.packageDetails || req.body.logisticsType || "Standard Delivery", //[cite: 5]
            status: req.body.status || "Pending", //[cite: 5]
            // FIXED: Handles source vs origin data mismatch mapping
            origin: req.body.origin || req.body.source || "customer" 
        };

        const newOrder = new Order(orderPayload); //[cite: 5]
        await newOrder.save(); //[cite: 5]
        
        io.emit('newOrderCreated', newOrder); //[cite: 5]
        sendTelegramAlert(newOrder); //[cite: 5]
        
        console.log(`Order created [Origin: ${orderPayload.origin}]: ${trackingId}`); //[cite: 5]
        res.status(201).json({ message: 'Order Created', trackingId }); //[cite: 5]
    } catch (error) {
        res.status(500).json({ error: error.message }); //[cite: 5]
    }
});

// Get all orders
app.get('/api/orders', async (req, res) => { //[cite: 5]
    try {
        const orders = await Order.find().sort({ createdAt: -1 }); //[cite: 5]
        res.json(orders); //[cite: 5]
    } catch (error) {
        res.status(500).json({ error: error.message }); //[cite: 5]
    }
});

// Update order status
app.put('/api/orders/:id', async (req, res) => { //[cite: 5]
    try {
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true }); //[cite: 5]
        if (updatedOrder) { //[cite: 5]
            io.emit('orderUpdated', updatedOrder); //[cite: 5]
            io.to(updatedOrder.trackingId).emit('statusChanged', updatedOrder); //[cite: 5]
        }
        res.json(updatedOrder); //[cite: 5]
    } catch (error) {
        res.status(500).json({ error: error.message }); //[cite: 5]
    }
});

// --- SUPPORT INQUIRY ENDPOINTS ---

// Submit a new inquiry from Contact Page
app.post('/api/admin/inquiries', async (req, res) => { //[cite: 5]
    try {
        const { fullName, emailAddress, msgSubject, messageBody } = req.body; //[cite: 5]

        if (!fullName || !emailAddress || !msgSubject || !messageBody) { //[cite: 5]
            return res.status(400).json({ error: 'Missing required payload parameters fields.' }); //[cite: 5]
        }

        const newInquiry = new Inquiry({ //[cite: 5]
            fullName, //[cite: 5]
            emailAddress, //[cite: 5]
            msgSubject, //[cite: 5]
            messageBody //[cite: 5]
        });

        await newInquiry.save(); //[cite: 5]

        io.emit('newInquirySubmitted', newInquiry); //[cite: 5]

        console.log(`📩 New message logged from: ${fullName}`); //[cite: 5]
        res.status(201).json({ message: 'Inquiry written to database successfully.' }); //[cite: 5]
    } catch (error) {
        console.error("Database Insertion Error Handler:", error); //[cite: 5]
        res.status(500).json({ error: error.message || 'Failed writing data to Mongo database collection cluster.' }); //[cite: 5]
    }
});

// Retrieve inquiries for Admin Desk Dashboard View
app.get('/api/admin/inquiries', async (req, res) => { //[cite: 5]
    try {
        const inquiries = await Inquiry.find().sort({ createdAt: -1 }); //[cite: 5]
        res.json(inquiries); //[cite: 5]
    } catch (error) {
        res.status(500).json({ error: error.message }); //[cite: 5]
    }
});

// --- EXISTING TRACKING ENDPOINTS ---
app.get('/api/track/:trackingId', async (req, res) => { //[cite: 5]
    try {
        const order = await Order.findOne({ trackingId: { $regex: new RegExp("^" + req.params.trackingId.trim() + "$", "i") } }); //[cite: 5]
        if (!order) return res.status(404).json({ message: 'Tracking ID not found' }); //[cite: 5]
        res.json(order); //[cite: 5]
    } catch (error) {
        res.status(500).json({ error: error.message }); //[cite: 5]
    }
});

app.get('/api/orders/:trackingId', async (req, res) => { //[cite: 5]
    try {
        const order = await Order.findOne({ trackingId: { $regex: new RegExp("^" + req.params.trackingId.trim() + "$", "i") } }); //[cite: 5]
        if (!order) return res.status(404).json({ message: 'Order not found' }); //[cite: 5]
        res.json(order); //[cite: 5]
    } catch (error) {
        res.status(500).json({ error: error.message }); //[cite: 5]
    }
});

// --- WEBSOCKETS ---
io.on('connection', (socket) => { //[cite: 5]
    socket.on('joinTrackingRoom', (trackingId) => { //[cite: 5]
        if (trackingId) socket.join(trackingId.trim()); //[cite: 5]
    });

    socket.on('updateOrderStatus', async ({ trackingId, newStatus }) => { //[cite: 5]
        try {
            const updatedOrder = await Order.findOneAndUpdate( //[cite: 5]
                { trackingId: { $regex: new RegExp("^" + trackingId.trim() + "$", "i") } }, //[cite: 5]
                { status: newStatus }, //[cite: 5]
                { new: true } //[cite: 5]
            );
            if (updatedOrder) { //[cite: 5]
                io.emit('orderUpdated', updatedOrder); //[cite: 5]
                io.to(updatedOrder.trackingId).emit('statusChanged', updatedOrder); //[cite: 5]
            }
        } catch (err) { console.error(err); } //[cite: 5]
    });

    socket.on('disconnect', () => console.log('User disconnected')); //[cite: 5]
});

const PORT = process.env.PORT || 3000; //[cite: 5]
server.listen(PORT, () => console.log(`🚀 ComfortXpress backend engine running on port ${PORT}`)); //[cite: 5]