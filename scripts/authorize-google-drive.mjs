import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { exec } from "node:child_process";

const args = process.argv.slice(2);
const valueFor = (flag) => args[args.indexOf(flag) + 1];
const credentialPath = valueFor("--credentials");
const folderId = valueFor("--folder");
const redirectUri = "http://localhost:53682/callback";

if (!credentialPath || !folderId) {
  console.error("Usage: node scripts/authorize-google-drive.mjs --credentials <path-to-client-secret.json> --folder <google-drive-folder-id>");
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8")).web;
if (!credentials?.client_id || !credentials?.client_secret) {
  throw new Error("This must be a Google OAuth Web application credential JSON file.");
}

const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authorizationUrl.search = new URLSearchParams({
  client_id: credentials.client_id,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/drive",
  access_type: "offline",
  prompt: "consent",
}).toString();

const server = http.createServer(async (request, response) => {
  if (!request.url?.startsWith("/callback")) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  try {
    const code = new URL(request.url, redirectUri).searchParams.get("code");
    if (!code) throw new Error("Google did not return an authorization code.");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.refresh_token) throw new Error("Google did not return a refresh token. Try again with a fresh browser window.");
    const secretDirectory = path.join(process.cwd(), ".secrets");
    fs.mkdirSync(secretDirectory, { recursive: true });
    const output = path.join(secretDirectory, "google-drive.env");
    fs.writeFileSync(output, [
      `GOOGLE_CLIENT_ID=${credentials.client_id}`,
      `GOOGLE_CLIENT_SECRET=${credentials.client_secret}`,
      `GOOGLE_REFRESH_TOKEN=${token.refresh_token}`,
      `GOOGLE_DRIVE_FOLDER_ID=${folderId}`,
    ].join("\n") + "\n", { mode: 0o600 });
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<h1>Google Drive connected</h1><p>You can close this tab and return to the terminal.</p>");
    console.log(`Authorization complete. Protected settings saved locally to ${output}`);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/html" });
    response.end("<h1>Authorization failed</h1><p>Check the terminal for details.</p>");
    console.error(error instanceof Error ? error.message : error);
  } finally {
    server.close();
  }
});

server.listen(53682, "127.0.0.1", () => {
  console.log("Open this Google authorization page in your browser:");
  console.log(authorizationUrl.toString());
  exec(`start "" "${authorizationUrl.toString()}"`);
});
