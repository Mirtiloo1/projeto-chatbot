require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

client
  .connect()
  .then(() => {
    console.log("Conectado ao PostgreSQL!");

    return client.query(`
        CREATE TABLE conversations (
        user_id VARCHAR(255) PRIMARY KEY,
        history JSONB,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);
  })
  .then(() => {
    console.log("Tabela criada com sucesso!");
  })
  .catch((err) => {
    console.error("Erro ao criar tabela:", err);
  })
  .finally(() => {
    client.end();
  });
