import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./env.js";

const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

export const supabase = SUPABASE_URL && supabaseKey
  ? createClient(SUPABASE_URL, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  : null;

console.log("Supabase URL:", SUPABASE_URL ? "✅ OK" : "❌ AUSENTE");
console.log("Supabase KEY:", SUPABASE_KEY ? "✅ OK" : "❌ AUSENTE");
console.log("Supabase Service Role:", SUPABASE_SERVICE_ROLE_KEY ? "✅ OK" : "❌ AUSENTE");
