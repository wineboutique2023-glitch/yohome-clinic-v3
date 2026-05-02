import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://你的project-id.supabase.co";
const supabaseAnonKey = "你的anon key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
