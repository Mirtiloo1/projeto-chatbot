const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  getSystemInstruction,
  safetySettings,
} = require("../config/geminiConfig");
const faqData = require("../utils/faqLoader")();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * @param {Array<object>} history
 * @param {string} userMessage
 * @returns {Promise<{iaResponse: string, updatedHistory: Array<object>}|null>}
 */

async function generateResponse(history, userMessage) {
  try {
    const systemInstruction = getSystemInstruction(faqData);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings,
      systemInstruction,
    });
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const iaResponse = response.text().trim();
    const updatedHistory = await chat.getHistory();

    console.log(`Resposta do Gemini: ${iaResponse}`);
    return { iaResponse, updatedHistory };
  } catch (error) {
    console.error("GEMINI SERVICE ERROR:", error);
    return null;
  }
}

module.exports = {
  generateResponse,
};
