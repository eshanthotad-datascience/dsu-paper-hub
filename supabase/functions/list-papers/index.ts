import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getGoogleAccessToken() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Drive has not been configured.");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) throw new Error("Google authorization failed.");
  return tokenData.access_token as string;
}

async function isAvailableInDrive(fileId: string, token: string) {
  const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,trashed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (driveResponse.status === 404) return false;
  if (!driveResponse.ok) return true;
  const file = await driveResponse.json();
  return !file.trashed;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return response({ error: "GET only" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Paper service has not been configured.");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: papers, error: queryError } = await adminClient
      .from("papers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) throw new Error("Could not load papers.");

    const token = await getGoogleAccessToken();
    const missingIds: string[] = [];
    const available = [];
    for (const paper of papers || []) {
      if (!paper.drive_file_id || !(await isAvailableInDrive(paper.drive_file_id, token))) missingIds.push(paper.id);
      else available.push({ ...paper, file_url: paper.drive_url });
    }

    if (missingIds.length) {
      const { error: deleteError } = await adminClient.from("papers").delete().in("id", missingIds);
      if (deleteError) throw new Error("Could not remove unavailable papers.");
    }

    return response({ papers: available, removed: missingIds.length });
  } catch (error) {
    console.error(error);
    return response({ error: error instanceof Error ? error.message : "Could not load papers." }, 500);
  }
});
