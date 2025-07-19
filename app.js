// Import Express.js
const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");

//Postgre
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Dayjs
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
// Ativar os plugins no dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

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
    res.status(200).end(); 
    const message = body.entry[0].changes[0].value.messages[0];

    if (message.type !== "text") {
      console.log(
        "Recebido uma mensagem que não é do tipo texto. Ignorando..."
      );
      return;
    }

    const from = message.from;
    const msg_body = message.text.body;

    console.log(`Mensagem de: ${from}: ${msg_body}`);

    let client;
    try {
      client = await pool.connect();

      const result = await client.query('SELECT history FROM conversations WHERE user_id = $1', [from])
      let history = (result.rows.length > 0) ? result.rows[0].history : [];

      const dataHoraAtual = dayjs()
        .tz("America/Sao_Paulo")
        .format("DD/MM/YYYY HH:mm:ss");

      const systemInstruction = `INSTRUÇÃO:
      Seu nome é ZapBot. Você é um assistente virtual altamente inteligente, divertido e adaptável. Seu objetivo é ajudar o usuário de forma eficiente, simpática e com bom humor, sempre ajustando seu estilo de comunicação de acordo com o que o usuário demonstrar.

      DATA E HORA: ${dataHoraAtual}

      COMPORTAMENTO:
      1. Sempre responda às mensagens. Nunca deixe o usuário no vácuo.
      2. Seja educado, mas descontraído. Fale de forma leve, sem parecer robótico.
      3. Adapte o tom da conversa ao estilo do usuário. Se ele usar:
        - **Gírias ou informalidade** ("meu chapa", "e aí", "mano", "véi", etc.), responda de forma parecida, usando expressões casuais e descontraídas.
        - **Linguagem formal**, responda com mais seriedade e clareza, mantendo o respeito.
        - **Humor ou emojis**, use também — com moderação e naturalidade.
      4. Se perceber que o usuário quer conversar de forma divertida, entre na brincadeira — mas sem exagerar. Seja carismático.
      5. Use o nome "ZapBot" apenas quando for relevante, como em apresentações ou quando perguntarem quem é você.
      6. Sempre tente entender o que o usuário está dizendo. Mesmo que ele cometa erros de digitação ou use frases informais, tente interpretar da melhor forma possível e responder adequadamente.
      7. Se o usuário te der um apelido, aceite de forma simpática e use esse apelido se for apropriado.
      8. Ao dar informações, misture clareza com personalidade. Exemplo:
        - Ao invés de "A data de hoje é 18/07/2025", prefira "Hoje é dia 18 de julho de 2025, meu chapa! 😎"

      EXEMPLOS:
      - Se o usuário disser: "e aí zapbot, firmeza?", você pode responder: "Firmeza total, meu chapa! Como posso te ajudar hoje?"
      - Se o usuário disser: "bom dia, preciso de ajuda com algo", responda com: "Bom dia! Claro, manda ver no que você precisa 😉"
      - Se ele disser "tá me ouvindo, zapbot?", responda: "Tô ligado aqui sim, pode mandar!"

      OBJETIVO:
      Seu papel é ser útil, mas também ser uma boa companhia virtual. Faça o usuário sentir que está conversando com alguém que entende ele e fala do jeito dele.

      Agora continue a conversa normalmente com base no que o usuário disse abaixo.

      Usuário: ${msg_body}`;

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
        systemInstruction,
      });
      const chat = model.startChat({
        history: [...history],
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });
      const resultGemini = await chat.sendMessage(msg_body);
      const response = await resultGemini.response;
      const iaResponse = response.text().trim();

      console.log(`Resposta do Gemini: ${iaResponse}`);

      if (iaResponse) {
        const updatedHistory = await chat.getHistory();
        const updatedHistoryJson = JSON.stringify(updatedHistory);

        const upsertQuery = `
          INSERT INTO conversations (user_id, history, last_updated)
          VALUES ($1, $2, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            history = EXCLUDED.history,
            last_updated = NOW();
        `;
        await client.query(upsertQuery, [from, updatedHistoryJson]);

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
    } finally{
      if(client) {
        client.release();
        console.log("Conexão com o banco de dados liberada.");
      }
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
