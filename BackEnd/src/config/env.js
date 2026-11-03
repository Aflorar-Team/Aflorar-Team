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
export const ADMIN_EMAIL = readEnv("ADMIN_EMAIL").toLowerCase();
export const GEMINI_API_KEY = readEnv("GEMINI_API_KEY");
export const PORT = readEnv("PORT") || "3000";
