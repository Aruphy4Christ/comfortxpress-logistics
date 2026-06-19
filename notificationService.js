const axios = require('axios'); //[cite: 2]
require('dotenv').config(); //[cite: 2]

/**
 * Sends a stylized tracking notification card to your Telegram group chat
 * @param {Object} orderData - The structure of the incoming logistics order
 */
async function sendTelegramAlert(orderData) {
    // FIXED: Destructured deliveryAddress alongside dropoffAddress to guarantee robust fallback logic
    const { trackingId, customerName, pickupAddress, dropoffAddress, deliveryAddress, origin } = orderData; //[cite: 2]
    
    // Determine how the order was created
    const channelLabel = origin === 'customer' ? '📱 [Client App]' : '🛡️ [Desk Entry]'; //[cite: 2]
    
    // FIXED: Modified template fallback rule logic string to prevent undefined text output errors
    const telegramMessage = 
`🔔 *New Dispatch Request!*
--------------------------------
*Channel:* ${channelLabel}
*Tracking ID:* \`${trackingId}\`
*Customer:* ${customerName}
*Route:* ${pickupAddress} ➔ ${dropoffAddress || deliveryAddress || 'Not Specified'}
--------------------------------
_Log into management dashboard to process immediate rider assignment._`;

    // Fire the message across the web to your group chat
    axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { //[cite: 2]
        chat_id: process.env.TELEGRAM_CHAT_ID, //[cite: 2]
        text: telegramMessage, //[cite: 2]
        parse_mode: 'Markdown' //[cite: 2]
    })
    .then(() => console.log(`🚀 Telegram broadcast dispatched for order: ${trackingId}`)) //[cite: 2]
    .catch(err => console.error("❌ Telegram Notification Error:", err.message)); //[cite: 2]
}

module.exports = { sendTelegramAlert }; //[cite: 2]