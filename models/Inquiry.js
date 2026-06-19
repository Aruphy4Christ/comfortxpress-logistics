const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    emailAddress: { type: String, required: true },
    msgSubject: { type: String, required: true },
    messageBody: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', InquirySchema);