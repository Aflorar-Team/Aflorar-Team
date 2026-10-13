import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const readEnv = (key) => String(process.env[key] || "").trim();
export const SUPABASE_URL = readEnv("SUPABASE_URL");
export const SUPABASE_KEY = readEnv("SUPABASE_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
export const GEMINI_API_KEY = readEnv("GEMINI_API_KEY");
export const PORT = readEnv("PORT") || "3000";
export const DB_HOST = readEnv("DB_HOST");
export const DB_USER = readEnv("DB_USER");
export const DB_PASSWORD = readEnv("DB_PASSWORD");
export const DB_NAME = readEnv("DB_NAME");
export const DB_PORT = readEnv("DB_PORT") || "3306";
export const DB_TYPE = (readEnv("DB_TYPE") || "mysql").toLowerCase();
export const CORS_ORIGINS = readEnv("CORS_ORIGINS").split(",").map((origem) => origem.trim()).filter(Boolean);