'use strict';

/**
 * notificationService.js
 * Sends a formatted dispatch alert to a configured Telegram group chat.
 *
 * Design decisions:
 *  - Uses native fetch (Node 18+) to avoid pulling in axios for a single call.
 *  - Non-blocking by design — callers must NOT await this function.
 *    Telegram delivery is best-effort; a failure must never crash order creation.
 *  - Errors are logged to stderr and do not propagate to callers.
 */

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * @param {Object} orderData
 * @param {string} orderData.trackingId
 * @param {string} orderData.customerName
 * @param {string} orderData.pickupAddress
 * @param {string} orderData.deliveryAddress
 * @param {string} [orderData.origin]  'customer' | 'admin'
 */
async function sendTelegramAlert(orderData) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        console.warn('Telegram not configured — skipping dispatch notification.');
        return;
    }

    const { trackingId, customerName, pickupAddress, deliveryAddress, origin } = orderData;
    const channelLabel = origin === 'admin' ? '🛡️ Desk Entry' : '📱 Client App';
    const destination  = deliveryAddress || 'Not Specified';

    const message =
`🔔 *New Dispatch Request*
\`\`\`
Channel  : ${channelLabel}
Tracking : ${trackingId}
Customer : ${customerName}
Route    : ${pickupAddress} ➔ ${destination}
\`\`\`
_Open the admin dashboard to assign a rider._`;

    try {
        const response = await fetch(
            `${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`,
            {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id:    CHAT_ID,
                    text:       message,
                    parse_mode: 'Markdown',
                }),
                signal: AbortSignal.timeout(8_000),
            }
        );

        if (!response.ok) {
            const body = await response.text();
            console.error(`Telegram API error [${response.status}]:`, body);
            return;
        }

        console.log(`📨 Telegram alert sent for order: ${trackingId}`);

    } catch (err) {
        console.error('Telegram notification failed:', err.message);
    }
}

module.exports = { sendTelegramAlert };