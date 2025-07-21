// Módulo principal do app
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Imports
const whatsappService = require("./services/whatsappService");
const geminiService = require("./services/geminiService");
const databaseService = require("./services/databaseService");

// Cria um app express
const app = express();
app.use(express.json());
app.use(cors());

// Variáveis de ambiente
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
console.log(process.env.NODE_ENV);

// Middleware para verificar a Chave de API
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"]; // 1. Pega a chave que veio na requisição

  // 2. Verifica se a chave existe e se é igual à que está no .env
  if (apiKey && apiKey === process.env.API_KEY) {
    next(); // 3. Se for igual, deixa a requisição passar para a próxima etapa
  } else {
    // 4. Se for diferente ou não existir, barra a entrada com um erro
    res.status(401).json({ error: "Acesso não autorizado" });
  }
}

// Rota requisição GET
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

// Rota requisição POST
app.post("/", async (req, res) => {
  try {
    res.status(200).end();
    const messagePayload = whatsappService.parseMessage(req.body);

    if (messagePayload) {
      const { from, msg_body } = messagePayload;
      console.log(`Mensagem recebida de ${from}: "${msg_body}"`);

      const history = await databaseService.getHistory(from);
      const result = await geminiService.generateResponse(history, msg_body);

      if (result && result.iaResponse) {
        const { iaResponse, updatedHistory } = result;

        await databaseService.saveHistory(from, updatedHistory);

        await whatsappService.sendMessage(from, iaResponse);
        console.log(`Resposta enviada para ${from}: "${iaResponse}"`);
      } else {
        console.log(
          "A resposta da IA foi vazia ou houve um erro no serviço Gemini."
        );
      }
    }
  } catch (error) {
    console.error("ERRO NO FLUXO PRINCIPAL:", error);
  }
});

app.get("/conversations", apiKeyAuth, async (req, res) => {
  try {
    console.log("Buscando histórico completo de conversas...");
    const fullHistory = await databaseService.getAllHistories();
    console.log("Histórico encontrado.");
    res.status(200).json(fullHistory);
  } catch (error) {
    console.log("Erro ao tentar buscar histórico completo de conversas", error);
    res
      .status(500)
      .json({ error: "Erro interno ao buscar histórico completo " });
  }
});

app.get("/conversations/:id", apiKeyAuth, async (req, res) => {
  try {
    const from = req.params.id;
    console.log(`Buscando histórico para: ${from}.`);
    const history = await databaseService.getHistory(from);
    console.log(`Histórico encontrado: ${history}`);
    res.status(200).json(history);
  } catch (error) {
    console.log("Erro ao tentar obter as mensagens.", error);
    res.status(500).json({ error: "Erro interno ao buscar histórico" });
  }
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`\nServidor rodando na porta ${port}. Aguardando mensagens...`);
});
