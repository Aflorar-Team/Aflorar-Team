import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import {
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USER,
} from "./env.js";

const pool = DB_HOST && DB_USER && DB_PASSWORD && DB_NAME
  ? mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT || 3306),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
  })
  : null;

export const createDbId = () => randomUUID();

export const getDbPool = () => pool;

export const ensureMysqlSchema = async () => {
  if (!pool) return false;

  const connection = await pool.getConnection();

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(36) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        password_salt VARCHAR(255) NOT NULL,
        cpf VARCHAR(20) DEFAULT NULL,
        telefone VARCHAR(20) DEFAULT NULL,
        crp VARCHAR(50) DEFAULT NULL,
        tipo ENUM('paciente', 'psicologo') NOT NULL DEFAULT 'paciente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS jardins (
        id VARCHAR(36) PRIMARY KEY,
        usuario_id VARCHAR(36) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        nivel INT NOT NULL DEFAULT 1,
        posicao INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_jardins_usuario_id (usuario_id),
        INDEX idx_jardins_usuario_posicao (usuario_id, posicao),
        CONSTRAINT fk_jardins_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    return true;
  } finally {
    connection.release();
  }
};
