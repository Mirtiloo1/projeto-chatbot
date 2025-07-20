// Módulo principal do app
const express = require("express");

// Imports
const whatsappService = require("./services/whatsappService");
const geminiService = require("./services/geminiService");
const databaseService = require("./services/databaseService");

// Cria um app express
const app = express();
app.use(express.json());

// Variáveis de ambiente
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

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

app.get("/conversations", async (req, res) => {
  try {
    
    res.status(200).json();
  } catch (error) {
    console.log("Erro ao tentar obter as mensagens.", error);
  }
});

app.post("/conversations", (req, res) => {
  res.status(200).send({
    mensagem: "Testando",
  });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`\nServidor rodando na porta ${port}. Aguardando mensagens...`);
});
