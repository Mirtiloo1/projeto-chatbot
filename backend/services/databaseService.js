const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * @param {string} userId - O ID do usuário (número de telefone).
 * @returns {Promise<Array>} O histórico da conversa ou um array vazio.
 */

async function getHistory(userId) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "SELECT history FROM conversations WHERE user_id = $1",
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0].history : [];
  } catch (error) {
    console.error("DATABASE ERROR ao buscar histórico:", error);
    return [];
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * @param {string} userId - O ID do usuário.
 * @param {Array} history - O novo histórico a ser salvo.
 */

async function saveHistory(userId, history) {
  const updatedHistoryJson = JSON.stringify(history);
  const upsertQuery = `
    INSERT INTO conversations (user_id, history, last_updated)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
    history = EXCLUDED.history,
    last_updated = NOW();
    `;
  let client;
  try {
    client = await pool.connect();
    await client.query(upsertQuery, [userId, updatedHistoryJson]);
  } catch (error) {
    console.error("DATABASE ERROR ao salvar histórico:", error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function getAllHistories() {
  let client;
  try {
    client = await pool.connect();
    const fullHistory = await client.query(
      "SELECT * FROM conversations ORDER BY last_updated DESC"
    );
    return fullHistory.rows;
  } catch (error) {
    console.log("Não foi possível obter histórico completo de conversas.");
    return [];
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  getHistory,
  saveHistory,
  getAllHistories,
};
