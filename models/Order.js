'use strict';

/**
 * Order Model
 *
 * Improvements over original:
 *  - Removed redundant dropoffAddress field (was a duplicate of deliveryAddress)
 *  - Added enum validation on status and origin at schema level
 *  - Added updatedAt timestamp (Mongoose timestamps option handles both)
 *  - Added index on trackingId (case-insensitive collation) for fast lookups
 *  - Added index on createdAt for sorted queries
 *  - Added optional riderName, riderPhone, notes for operational completeness
 *  - maxlength guards on string fields prevent oversized payloads reaching DB
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema(
    {
        trackingId: {
            type:      String,
            required:  [true, 'Tracking ID is required.'],
            unique:    true,
            uppercase: true,
            trim:      true,
            maxlength: [20, 'Tracking ID must not exceed 20 characters.'],
            index:     true,
        },
        customerName: {
            type:      String,
            required:  [true, 'Customer name is required.'],
            trim:      true,
            maxlength: [100, 'Customer name must not exceed 100 characters.'],
            default:   'Guest User',
        },
        pickupAddress: {
            type:      String,
            required:  [true, 'Pickup address is required.'],
            trim:      true,
            maxlength: [300, 'Pickup address must not exceed 300 characters.'],
        },
        deliveryAddress: {
            type:      String,
            trim:      true,
            maxlength: [300, 'Delivery address must not exceed 300 characters.'],
            default:   '',
        },
        packageDetails: {
            type:      String,
            trim:      true,
            maxlength: [500, 'Package details must not exceed 500 characters.'],
            default:   'Standard Delivery',
        },
        status: {
            type:    String,
            enum:    {
                values:  ['Pending', 'Assigned', 'In Transit', 'Delivered', 'Cancelled'],
                message: '{VALUE} is not a valid order status.',
            },
            default: 'Pending',
            index:   true,
        },
        origin: {
            type:    String,
            enum:    {
                values:  ['customer', 'admin'],
                message: '{VALUE} is not a valid origin.',
            },
            default: 'customer',
        },
        // Operational fields — populated by admin when assigning a rider
        riderName: {
            type:      String,
            trim:      true,
            maxlength: [100, 'Rider name must not exceed 100 characters.'],
            default:   null,
        },
        riderPhone: {
            type:    String,
            trim:    true,
            match:   [/^\+?[\d\s\-()]{7,20}$/, 'Please enter a valid phone number.'],
            default: null,
        },
        notes: {
            type:      String,
            trim:      true,
            maxlength: [1000, 'Notes must not exceed 1000 characters.'],
            default:   null,
        },
    },
    {
        timestamps: true,  // adds createdAt + updatedAt automatically
        versionKey: false, // removes __v field
    }
);

// Compound index for common admin list query: all orders sorted by newest first
OrderSchema.index({ createdAt: -1 });

// Compound index for status-filtered queries (e.g. "show me all Pending orders")
OrderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;