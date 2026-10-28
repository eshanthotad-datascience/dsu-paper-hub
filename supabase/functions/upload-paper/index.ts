import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/png"]);

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_");
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

async function uploadToDrive(file: File, token: string, folderId: string) {
  const boundary = `dsu-paper-${crypto.randomUUID()}`;
  const metadata = { name: safeName(file.name), mimeType: file.type, parents: [folderId] };
  const body = new Blob([`--${boundary}\r\n`, "Content-Type: application/json; charset=UTF-8\r\n\r\n", JSON.stringify(metadata), `\r\n--${boundary}\r\n`, `Content-Type: ${file.type}\r\n\r\n`, await file.arrayBuffer(), `\r\n--${boundary}--`]);
  const uploadResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
  const driveFile = await uploadResponse.json();
  if (!uploadResponse.ok || !driveFile.id) throw new Error("Google Drive upload failed.");
  const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "anyone", role: "reader" }),
  });
  if (!permissionResponse.ok) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    throw new Error("Could not set the file's viewing permission.");
  }
  return { id: driveFile.id as string, url: `https://drive.google.com/file/d/${driveFile.id}/view` };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "POST only" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
    if (!supabaseUrl || !serviceRoleKey || !folderId) throw new Error("Upload service has not been configured.");
    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    const title = String(form.get("title") ?? "").trim();
    const branch = String(form.get("branch") ?? "").trim();
    const cycle = String(form.get("cycle") ?? "").trim();
    const subjectCode = String(form.get("subject_code") ?? "").trim();
    const semester = Number(form.get("semester"));
    const examYear = Number(form.get("exam_year"));
    const examType = String(form.get("exam_type") ?? "").trim();
    if (!files.length || !title || !branch || !Number.isInteger(semester) || !Number.isInteger(examYear) || !examType) return response({ error: "Please complete the paper details and choose at least one file." }, 400);
    if (cycle && cycle !== "Chemistry cycle" && cycle !== "Physics cycle") return response({ error: "Invalid cycle." }, 400);
    if (semester < 1 || semester > 12 || examYear < 2000 || examYear > 2100) return response({ error: "Check semester and exam year." }, 400);
    if (files.some((file) => !allowedTypes.has(file.type) || file.size === 0 || file.size > maxFileSize)) return response({ error: "Only PDFs or PNGs up to 10 MB each are allowed." }, 400);
    const token = await getGoogleAccessToken();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const batchId = crypto.randomUUID();
    const uploaded: Array<{ id: string; url: string }> = [];
    const rows = [];
    for (const file of files) {
      const driveFile = await uploadToDrive(file, token, folderId);
      uploaded.push(driveFile);
      rows.push({ title: files.length === 1 ? title : `${title} - ${file.name}`, subject_code: subjectCode || null, branch, cycle: cycle || null, semester, exam_year: examYear, exam_type: examType, drive_file_id: driveFile.id, drive_url: driveFile.url, file_name: file.name, file_type: file.type, file_size: file.size, upload_batch_id: batchId });
    }
    const { error: databaseError } = await adminClient.from("papers").insert(rows);
    if (databaseError) {
      await Promise.all(uploaded.map(({ id }) => fetch(`https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })));
      throw new Error("Could not save paper details.");
    }
    return response({ success: true, count: rows.length });
  } catch (error) {
    console.error(error);
    return response({ error: error instanceof Error ? error.message : "Upload failed." }, 500);
  }
});
