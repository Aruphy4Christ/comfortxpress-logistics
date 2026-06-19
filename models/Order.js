const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    trackingId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    deliveryAddress: { type: String },
    dropoffAddress: { type: String, required: true },
    packageDetails: { type: String, default: "Standard Delivery" },
    status: { type: String, default: "Pending" },
    origin: { type: String, default: "customer" },
    source: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);