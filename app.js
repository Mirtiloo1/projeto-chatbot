// Import Express.js
const express = require("express");
const axios = require("axios");
const { OpenAI } = require("openai");

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Environment variables
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route for GET requests
app.get("/", (req, res) => {
  const {
    "hub.mode": mode,
    "hub.challenge": challenge,
    "hub.verify_token": token,
  } = req.query;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WEBHOOK VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests
app.post("/", async (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    const entry = body.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;

    if (value.messages) {
      const message = value.messages[0];
      const from = message.from;
      const msg_body = message.text.body;

      console.log(`Mensagem de ${from}: ${msg_body}`);

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: msg_body }],
        });

        const iaResponse = completion.choices[0].message.content;
        console.log(`Resposta da IA: ${iaResponse}`);

        axios({
          method: "POST",
          url: `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${whatsappToken}`,
          },
          data: {
            messaging_product: "whatsapp",
            to: from,
            text: {
              body: iaResponse,
            },
          },
        });
      } catch (error) {
        console.error(
          "Ocorreu um erro:",
          error.response ? error.response.data : error.message
        );
      }
    }
  }
  res.status(200).end();
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
