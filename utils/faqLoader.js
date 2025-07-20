const fs = require("fs");
const path = require("path");

/**
 * @returns {object|null}
 */

function carregarFaqJson() {
  try {
    const filePath = path.join(__dirname, "..", "faq.json");

    const data = fs.readFileSync(filePath, "utf8");
    const dados = JSON.parse(data);

    console.log("Módulo faqLoader: FAQ carregado com sucesso!");
    return dados;
  } catch (err) {
    console.error("Módulo faqLoader: ERRO AO CARREGAR O ARQUIVO FAQ:", err);
    return null;
  }
}
module.exports = carregarFaqJson;
