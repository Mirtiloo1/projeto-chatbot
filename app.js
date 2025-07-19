// Import Express.js
const express = require("express");
const axios = require("axios");

// Dayjs
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
// Ativar os plugins no dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

// Histórico de conversas
let conversationHistories = {};

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

  if (
    body.object === "whatsapp_business_account" &&
    body.entry[0]?.changes[0]?.value?.messages?.[0]
  ) {
    const message = body.entry[0].changes[0].value.messages[0];

    if (message.type !== "text") {
      console.log(
        "Recebido uma mensagem que não é do tipo texto. Ignorando..."
      );
      return res.status(200).end();
    }

    const from = message.from;
    const msg_body = message.text.body;

    console.log(`Mensagem de: ${from}: ${msg_body}`);

    try {
      const dataHoraAtual = dayjs()
        .tz("America/Sao_Paulo")
        .format("DD/MM/YYYY HH:mm:ss");
      let history = conversationHistories[from] || [];

      const safetySettings = [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ];

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        safetySettings,
      });
      const chat = model.startChat({
        history: [...history],
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const instrucoes = `INSTRUÇÃO: Você é um assistente prestativo. A data e hora atuais são ${dataHoraAtual}. Seu nome é ZapBot e você deve agir de forma maneira pois você é super maneiro. Você não deve deixar a pessoa com quem está conversando no vácuo. Deve sempre responder.\n\nUsuário: ${msg_body}`;

      const result = await chat.sendMessage(instrucoes);
      const response = await result.response;
      const iaResponse = response.text().trim();

      console.log(`Resposta do Gemini: ${iaResponse}`);

      if (iaResponse) {
        conversationHistories[from] = await chat.getHistory();

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
            text: { body: iaResponse },
          },
        });
      } else {
        console.log("A resposta da IA foi vazia. Nenhuma mensagem enviada.");
      }
    } catch (error) {
      console.log("Ocorreu um erro:", error);
    }
  }
  res.status(200).end();
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
