// Import Express.js
const express = require("express");
const axios = require("axios");
// const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Environment variables
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

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

      const systemInstruction =
        "Você é o ZapBot super maneirão. Você deve agir como se fosse super maneiro e conversar sempre no idioma Português Brasileiro de forma amigável e maneira.";
      const fullPrompt =
        systemInstruction + "\n\n" + "Pergunta do cliente: " + msg_body;

      console.log(`Mensagem de ${from}: ${msg_body}`);

      try {
        // GEMINI
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const iaResponse = response.text();

        console.log(`Resposta do Gemini: ${iaResponse}`);

        // CHAT GPT - OPENAI
        // const completion = await openai.chat.completions.create({
        //   model: "gpt-3.5-turbo",
        //   messages: [{ role: "user", content: msg_body }],
        // });

        // const iaResponse = completion.choices[0].message.content;
        // console.log(`Resposta da IA: ${iaResponse}`);

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
