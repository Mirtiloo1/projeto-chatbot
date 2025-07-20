const axios = require("axios");

const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

/**
 * @param {object}
 * @returns {{from: string, msg_body: string}|null}
 */

function parseMessage(body) {
  if (
    body.object === "whatsapp_business_account" &&
    body.entry[0]?.changes[0]?.value?.messages?.[0]
  ) {
    const message = body.entry[0].changes[0].value.messages[0];

    if (message.type === "text") {
      return {
        from: message.from,
        msg_body: message.text.body,
      };
    }
  }
  return null;
}

/**
 * @param {string}
 * @param {string}
 */

async function sendMessage(to, text) {
  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${whatsappToken}`,
      },
      data: {
        messaging_product: "whatsapp",
        to: to,
        text: { body: text },
      },
    });
  } catch (error) {
    console.error(
      "WHATSAPP SERVICE ERROR: Falha ao enviar mensagem:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

module.exports = {
  parseMessage,
  sendMessage,
};
