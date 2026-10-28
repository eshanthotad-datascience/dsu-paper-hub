
import { supabase } from "./lib/supabase";

export async function testConnection() {
  const { error } = await supabase
    .from("papers")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Supabase connection failed:", error.message);
    return false;
  }

  console.log("Supabase connection successful!");
  return true;
}
