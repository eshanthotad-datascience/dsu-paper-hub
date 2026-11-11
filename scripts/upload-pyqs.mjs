import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

const driveEnv = loadEnv(path.join(process.cwd(), ".secrets", "google-drive.env"));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirFlagIndex = args.indexOf("--dir");
const sourceDir = dirFlagIndex !== -1 ? args[dirFlagIndex + 1] : "C:\\Users\\ESHAN\\New folder (2)\\papers";

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_");
}

function parseSessionYear(folderName) {
  const match = folderName.match(/^(\d{2})/);
  if (!match) return new Date().getFullYear();
  return 2000 + Number(match[1]);
}

function parsePaperFilename(fileName) {
  const base = fileName.replace(/\.pdf$/i, "").trim();
  const match = base.match(/^(?:\d+_)?([0-9]{2}[A-Z]{2,4}[0-9]{3,4})\s*(?:-|\s)\s*(.+)$/i);
  if (match) {
    return {
      subjectCode: match[1].toUpperCase(),
      title: match[2].replace(/^-\s*/, "").trim(),
    };
  }
  return { subjectCode: "", title: base };
}

function collectPdfs(rootDir) {
  const results = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "Sorted_By_Subject") continue;
    const subDir = path.join(rootDir, entry.name);
    const examYear = parseSessionYear(entry.name);
    for (const file of fs.readdirSync(subDir, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.toLowerCase().endsWith(".pdf")) continue;
      const fullPath = path.join(subDir, file.name);
      const { subjectCode, title } = parsePaperFilename(file.name);
      results.push({
        fullPath,
        fileName: file.name,
        safeFileName: safeName(file.name),
        folder: entry.name,
        examYear,
        subjectCode,
        title,
        size: fs.statSync(fullPath).size,
      });
    }
  }
  return results.sort((a, b) => b.examYear - a.examYear || a.title.localeCompare(b.title));
}

async function getGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = driveEnv;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Missing Google Drive credentials in .secrets/google-drive.env");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token refresh failed: ${data.error_description || data.error || res.status}`);
  }
  return data.access_token;
}

async function listDriveFiles(token, folderId) {
  const existing = new Map();
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Drive list failed: ${JSON.stringify(data)}`);
    for (const file of data.files || []) {
      existing.set(file.name, file.id);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return existing;
}

async function setPublicReader(fileId, token) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Permission failed for ${fileId}: ${text}`);
  }
}

async function uploadToDrive(paper, token, folderId) {
  const boundary = `dsu-paper-${crypto.randomUUID()}`;
  const metadata = { name: paper.safeFileName, mimeType: "application/pdf", parents: [folderId] };
  const fileBuffer = fs.readFileSync(paper.fullPath);
  const body = new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    "Content-Type: application/pdf\r\n\r\n",
    fileBuffer,
    `\r\n--${boundary}--`,
  ]);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const driveFile = await res.json();
  if (!res.ok || !driveFile.id) {
    throw new Error(`Drive upload failed for ${paper.fileName}: ${JSON.stringify(driveFile)}`);
  }
  await setPublicReader(driveFile.id, token);
  return driveFile.id;
}

function sqlQuote(val) {
  if (val === null || val === undefined) return "null";
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  const pdfs = collectPdfs(sourceDir);
  console.log(`Found ${pdfs.length} PDFs in ${sourceDir}`);

  if (dryRun) {
    for (const p of pdfs) {
      console.log(`[${p.folder} | ${p.examYear}] ${p.subjectCode} -> ${p.title}`);
    }
    return;
  }

  const folderId = driveEnv.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID in .secrets/google-drive.env");

  const token = await getGoogleAccessToken();
  const existingFiles = await listDriveFiles(token, folderId);
  console.log(`Existing files in Google Drive folder: ${existingFiles.size}`);

  const batchId = crypto.randomUUID();
  const catalog = [];
  let uploadedCount = 0;
  let reusedCount = 0;

  for (let i = 0; i < pdfs.length; i++) {
    const paper = pdfs[i];
    let fileId = existingFiles.get(paper.safeFileName) || existingFiles.get(paper.fileName);
    if (fileId) {
      reusedCount++;
      console.log(`[${i + 1}/${pdfs.length}] Reusing existing Drive file: ${paper.safeFileName}`);
    } else {
      fileId = await uploadToDrive(paper, token, folderId);
      uploadedCount++;
      console.log(`[${i + 1}/${pdfs.length}] Uploaded to Drive: ${paper.subjectCode} - ${paper.title} (${fileId})`);
    }

    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
    catalog.push({
      id: `pyq-${fileId}`,
      title: paper.title,
      subject_code: paper.subjectCode || null,
      branch: "All branches",
      cycle: null,
      semester: 1,
      exam_year: paper.examYear,
      exam_type: "End Semester",
      drive_file_id: fileId,
      drive_url: driveUrl,
      file_url: driveUrl,
      file_name: paper.fileName,
      file_type: "application/pdf",
      file_size: paper.size,
      upload_batch_id: batchId,
    });
  }

  const outJsonPath = path.join(process.cwd(), "src", "data", "papers.json");
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, JSON.stringify(catalog, null, 2) + "\n");

  const sqlRows = catalog.map((r) =>
    `(${sqlQuote(r.title)}, ${sqlQuote(r.subject_code)}, ${sqlQuote(r.branch)}, null, ${r.semester}, ${r.exam_year}, ${sqlQuote(r.exam_type)}, ${sqlQuote(r.drive_file_id)}, ${sqlQuote(r.drive_url)}, ${sqlQuote(r.file_name)}, ${sqlQuote(r.file_type)}, ${r.file_size}, ${sqlQuote(r.upload_batch_id)})`,
  );
  const seedSql = `-- Auto-generated seed for all ${catalog.length} PYQs uploaded to Google Drive\n` +
    `insert into public.papers (title, subject_code, branch, cycle, semester, exam_year, exam_type, drive_file_id, drive_url, file_name, file_type, file_size, upload_batch_id)\nvalues\n${sqlRows.join(",\n")};\n`;
  fs.writeFileSync(path.join(process.cwd(), "supabase", "seed_papers.sql"), seedSql);

  console.log(`Done! Uploaded: ${uploadedCount}, Reused: ${reusedCount}, Total in catalog: ${catalog.length}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
