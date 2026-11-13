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

const sourceDir = "C:\\Users\\ESHAN\\New folder (2)\\papers";

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_");
}

function normalizeBranch(rawBranch) {
  if (!rawBranch || rawBranch === "All branches") return "All branches";
  const b = rawBranch.trim();
  if (b === "Computer Science & Engineering") return "Computer Science & Engineering (CSE)";
  if (b === "Electronics & Communication Engineering") return "Electronics & Communication Engineering (ECE)";
  if (b === "Mechanical Engineering") return "Mechanical Engineering";
  if (b === "Aerospace Engineering") return "Aerospace Engineering";
  if (b === "Computer Technology") return "Computer Science & Technology (CST)";
  if (b === "Artificial Intelligence and Machine Learning" || b === "AI & ML" || b === "Computer Science & Engineering - AI & ML") {
    return "Artificial Intelligence & Machine Learning (AIML)";
  }
  if (b === "Data Science") return "Data Science";
  if (b === "Cyber Security" || b === "Computer Science & Engineering - Cyber Security") return "Cyber Security";
  if (b === "AI & Data Science") return "AI & Data Science";
  if (b.toLowerCase() === "ai & robotics") return "Artificial Intelligence & Robotics";
  if (b === "OE") return "Open Electives (OE)";
  if (b === "Institutional Electives") return "Institutional Electives";
  return b;
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

function parseYearFromPath(str) {
  const m = str.match(/\b(202[1-6])\b/);
  if (m) return parseInt(m[1], 10);
  const m2 = str.match(/[-_\s](2[1-6])\b/);
  if (m2) return 2000 + parseInt(m2[1], 10);
  return 2024;
}

function collectAllPdfs(baseDir) {
  const results = [];
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "Sorted_By_Subject") continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        const rel = path.relative(baseDir, fullPath);
        const parts = rel.split(path.sep);
        
        let semester = 1;
        let rawBranch = "All branches";
        let examYear = 2024;
        
        if (parts[0].startsWith("Sem ")) {
          const semNum = parseInt(parts[0].replace("Sem ", ""), 10);
          semester = isNaN(semNum) ? 1 : semNum;
          if (parts.length > 1) rawBranch = parts[1];
          if (parts.length > 2) examYear = parseYearFromPath(parts[2]);
        } else if (parts[0] === "sem 2 26") {
          semester = 2;
          rawBranch = "All branches";
          examYear = 2026;
        } else {
          // Sem 1 legacy folders (21, 22, 24, 25 dec, 25 jan)
          semester = 1;
          rawBranch = "All branches";
          examYear = parseYearFromPath(parts[0]);
        }
        
        const branch = normalizeBranch(rawBranch);
        const { subjectCode, title } = parsePaperFilename(entry.name);
        
        results.push({
          fullPath,
          fileName: entry.name,
          safeFileName: safeName(entry.name),
          semester,
          branch,
          examYear,
          subjectCode,
          title,
          size: fs.statSync(fullPath).size
        });
      }
    }
  }
  
  walk(baseDir);
  // Sort by semester asc, branch, title
  return results.sort((a, b) => a.semester - b.semester || a.branch.localeCompare(b.branch) || a.title.localeCompare(b.title));
}

async function getGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = driveEnv;
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
    throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function listDriveFiles(token, folderId) {
  const existing = new Map();
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
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
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "anyone", role: "reader" }),
    });
  } catch (e) {
    // Ignore if permission already set
  }
}

async function uploadToDrive(paper, token, folderId, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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
        throw new Error(`Drive upload failed: ${JSON.stringify(driveFile)}`);
      }
      await setPublicReader(driveFile.id, token);
      return driveFile.id;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

function sqlQuote(val) {
  if (val === null || val === undefined) return "null";
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  console.log("Collecting all PDFs from:", sourceDir);
  const pdfs = collectAllPdfs(sourceDir);
  console.log(`Found ${pdfs.length} total PDFs across all semesters.`);

  const folderId = driveEnv.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID in .secrets/google-drive.env");

  let token = await getGoogleAccessToken();
  let tokenTime = Date.now();
  
  async function getFreshToken() {
    if (Date.now() - tokenTime > 45 * 60 * 1000) { // refresh every 45 min
      token = await getGoogleAccessToken();
      tokenTime = Date.now();
    }
    return token;
  }

  const existingFiles = await listDriveFiles(token, folderId);
  console.log(`Existing files in Google Drive folder: ${existingFiles.size}`);

  const batchId = crypto.randomUUID();
  const catalog = [];
  let uploadedCount = 0;
  let reusedCount = 0;
  let errorCount = 0;

  // Process with concurrency pool of 8 workers
  const CONCURRENCY = 8;
  let currentIndex = 0;
  const total = pdfs.length;

  async function worker() {
    while (true) {
      const idx = currentIndex++;
      if (idx >= total) break;
      const paper = pdfs[idx];
      
      const currentToken = await getFreshToken();
      let fileId = existingFiles.get(paper.safeFileName) || existingFiles.get(paper.fileName);
      
      if (fileId) {
        reusedCount++;
      } else {
        try {
          fileId = await uploadToDrive(paper, currentToken, folderId);
          existingFiles.set(paper.safeFileName, fileId);
          uploadedCount++;
        } catch (err) {
          errorCount++;
          console.error(`[Error] ${paper.fileName}: ${err.message}`);
          continue;
        }
      }

      const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
      catalog.push({
        id: `pyq-${fileId}`,
        title: paper.title,
        subject_code: paper.subjectCode || null,
        branch: paper.branch,
        cycle: null,
        semester: paper.semester,
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

      if ((idx + 1) % 50 === 0 || idx + 1 === total) {
        console.log(`Progress: [${idx + 1}/${total}] (Uploaded: ${uploadedCount}, Reused: ${reusedCount}, Errors: ${errorCount})`);
      }
    }
  }

  console.log(`Starting concurrent upload with ${CONCURRENCY} workers...`);
  const startTime = Date.now();
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nFinished in ${duration}s! Uploaded: ${uploadedCount}, Reused: ${reusedCount}, Errors: ${errorCount}`);
  console.log(`Total papers in new catalog: ${catalog.length}`);

  // Sort catalog by semester, branch, title
  catalog.sort((a, b) => a.semester - b.semester || a.branch.localeCompare(b.branch) || a.title.localeCompare(b.title));

  const outJsonPath = path.join(process.cwd(), "src", "data", "papers.json");
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Updated ${outJsonPath} successfully!`);

  // Write seed SQL
  const sqlRows = catalog.map((r) =>
    `(${sqlQuote(r.title)}, ${sqlQuote(r.subject_code)}, ${sqlQuote(r.branch)}, null, ${r.semester}, ${r.exam_year}, ${sqlQuote(r.exam_type)}, ${sqlQuote(r.drive_file_id)}, ${sqlQuote(r.drive_url)}, ${sqlQuote(r.file_name)}, ${sqlQuote(r.file_type)}, ${r.file_size}, ${sqlQuote(r.upload_batch_id)})`,
  );
  const seedSql = `-- Auto-generated seed for all ${catalog.length} PYQs uploaded to Google Drive\n` +
    `insert into public.papers (title, subject_code, branch, cycle, semester, exam_year, exam_type, drive_file_id, drive_url, file_name, file_type, file_size, upload_batch_id)\nvalues\n${sqlRows.join(",\n")};\n`;
  fs.writeFileSync(path.join(process.cwd(), "supabase", "seed_papers.sql"), seedSql);
  console.log(`Updated supabase/seed_papers.sql successfully!`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
