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

// FAQ
var fs = require("fs");
function carregarFaqJson() {
  try {
    const data = fs.readFileSync("faq.json", "utf-8");
    const dados = JSON.parse(data);
    console.log("Dados carregados com sucesso!");
    return dados;
  } catch (err) {
    console.log("Erro ao tentar carregar o arquivo FAQ:", err);
    return null;
  }
}

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
      const faqData = carregarFaqJson();
      if (!faqData) {
        console.log("Não foi possível carregar o FAQ. Usando prompt padrão.");
      }
      client = await pool.connect();

      const result = await client.query(
        "SELECT history FROM conversations WHERE user_id = $1",
        [from]
      );
      let history = result.rows.length > 0 ? result.rows[0].history : [];

      const dataHoraAtual = dayjs()
        .tz("America/Sao_Paulo")
        .format("DD/MM/YYYY HH:mm:ss");

      const systemInstruction = `
      INSTRUÇÃO:
      Você é o assistente virtual da "Pizzaria Painho". Seu nome é "Painho". Sua principal função é atender os clientes de forma rápida, clara e cordial, fornecendo informações precisas e auxiliando na realização de pedidos.

      FONTE DE CONHECIMENTO:
      Use as informações abaixo, fornecidas no formato JSON, como sua ÚNICA FONTE DE VERDADE para responder sobre cardápio, horários, taxas e áreas de entrega. Não invente preços, ingredientes ou produtos que não estejam listados aqui.
      JSON: ${JSON.stringify(faqData)}

      CONTEXTO ATUAL:
      A data e hora atuais são: ${dataHoraAtual}.

      REGRAS DE COMPORTAMENTO:
      1.  **Tom de Voz:** Seja sempre profissional, prestativo e amigável. Use "você" e evite gírias, mesmo que o cliente as use. O objetivo é ser eficiente e simpático, como um bom atendente.
      2.  **Objetividade:** Forneça respostas claras e diretas. Se um cliente perguntar sobre uma pizza, liste os ingredientes e o preço consultando a FONTE DE CONHECIMENTO.
      3.  **Proatividade para Vender:** Ao final de cada resposta informativa, sempre incentive o próximo passo de forma sutil. Use frases como "Posso ajudar com mais alguma informação?", "Gostaria de ver o cardápio completo?" ou "Pronto para anotar seu pedido?".
      4.  **Uso de Emojis:** Use emojis de forma moderada e apenas quando fizerem sentido com o tema de pizzaria (ex: 🍕, 🛵, 👍, 😉).
      5.  **Lidar com Limitações:** Se não souber a resposta ou se o pedido for muito complexo (ex: agendamentos, grandes eventos), direcione o cliente para o atendimento humano de forma educada. Use a frase: "Para essa solicitação, por favor, ligue para nosso número que um de nossos atendentes irá te ajudar."

      FLUXO DE ATENDIMENTO:
      1.  Cumprimente o cliente e se apresente brevemente na primeira mensagem da conversa.
      2.  Responda às perguntas do cliente usando estritamente a FONTE DE CONHECIMENTO.
      3.  Se o cliente demonstrar interesse em pedir, guie-o, perguntando o sabor da pizza, tamanho, se deseja adicionar borda, bebida, etc.
      4.  Ao final, sempre agradeça o contato.

      EXEMPLOS DE INTERAÇÃO:
      -   **Usuário:** "vcs abrem hj?"
          **Resposta Ideal:** "Sim, abrimos! Hoje nosso horário de funcionamento é das 18h às 23h. Gostaria de ver o cardápio? 🍕"

      -   **Usuário:** "qual o preço da pizza de calabresa"
          **Resposta Ideal:** "A nossa pizza de Calabresa no tamanho Grande custa R$ 45,00. Ela vem com molho de tomate, mussarela, calabresa fatiada e cebola. Posso anotar o seu pedido?"

      -   **Usuário:** "vc pode agendar meu pedido pra mais tarde?"
          **Resposta Ideal:** "No momento, não consigo agendar pedidos com horário marcado por aqui. Para solicitações especiais como essa, por favor, ligue para o nosso número que um de nossos atendentes irá te ajudar. 👍"

      Agora, comece ou continue a conversa com o usuário.
      `;

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
    } finally {
      if (client) {
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
