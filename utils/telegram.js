const axios = require('axios');
const logger = require('./logger'); // Use your existing logger!

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

/**
 * Sends a notification to the configured Telegram chat.
 * @param {string} message - The message to send.
 */
async function notify(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    logger.warn('Telegram notify called, but BOT_TOKEN or CHAT_ID is missing.');
    return;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      { 
        chat_id: CHAT_ID, 
        text: message, 
        parse_mode: 'HTML' 
      },
      { timeout: 5000 } // Set timeout to 5 seconds
    );
  } catch (err) {
    // Log the error using your existing logging utility
    logger.error('Telegram notification failed:', err.response?.data || err.message);
  }
}

module.exports = { notify };