import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yubwwqcohdjtvvryvvzs.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1Ynd3cWNvaGRqdHZ2cnl2dnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTQ0ODYsImV4cCI6MjA5MzA3MDQ4Nn0.CeckQyeDPySjb7bOU2Tmrn_mgNAzfVneTemwDNEEDdE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
