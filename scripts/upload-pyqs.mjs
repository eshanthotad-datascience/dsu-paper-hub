import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env");
const envVars = fs.existsSync(envFile)
  ? Object.fromEntries(fs.readFileSync(envFile, "utf8").trim().split(/\r?\n/).filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }))
  : {};

const supabaseUrl = process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirFlagIndex = args.indexOf("--dir");
const sourceDir = dirFlagIndex !== -1 ? args[dirFlagIndex + 1] : "C:\\Users\\ESHAN\\New folder (2)\\papers";

function parseSessionYear(folderName) {
  const match = folderName.match(/^(\d{2})/);
  if (!match) return new Date().getFullYear();
  return 2000 + Number(match[1]);
}

function parsePaperFilename(fileName) {
  const base = fileName.replace(/\.pdf$/i, "").trim();
  // Formats:
  // "20EN1101 - Engineering Mathematics I"
  // "7119_21EN1104 - Elements of Mechanical Engineering"
  // "9571_25EN1119 Engineering Mechanics"
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
        folder: entry.name,
        examYear,
        subjectCode,
        title,
      });
    }
  }
  return results;
}

async function fetchExistingPapers() {
  const res = await fetch(`${supabaseUrl}/rest/v1/papers?select=file_name,subject_code,title`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (!res.ok) return [];
  return res.json();
}

async function uploadOne(paper) {
  const buffer = fs.readFileSync(paper.fullPath);
  const form = new FormData();
  form.append("files", new Blob([buffer], { type: "application/pdf" }), paper.fileName);
  form.append("title", paper.title);
  form.append("subject_code", paper.subjectCode);
  form.append("branch", "All branches");
  form.append("cycle", "");
  form.append("semester", "1");
  form.append("exam_year", String(paper.examYear));
  form.append("exam_type", "End Semester");

  const res = await fetch(`${supabaseUrl}/functions/v1/upload-paper`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  }
  const pdfs = collectPdfs(sourceDir);
  console.log(`Found ${pdfs.length} PDFs in ${sourceDir}`);

  if (dryRun) {
    for (const p of pdfs) {
      console.log(`[${p.folder} | ${p.examYear}] ${p.subjectCode} -> ${p.title}`);
    }
    return;
  }

  const existing = await fetchExistingPapers();
  const existingNames = new Set(existing.map((e) => e.file_name));

  let uploaded = 0;
  let skipped = 0;
  for (const paper of pdfs) {
    if (existingNames.has(paper.fileName)) {
      console.log(`SKIP (already uploaded): ${paper.fileName}`);
      skipped++;
      continue;
    }
    try {
      await uploadOne(paper);
      uploaded++;
      console.log(`[${uploaded}/${pdfs.length}] Uploaded: ${paper.subjectCode} - ${paper.title}`);
    } catch (err) {
      console.error(`FAILED on ${paper.fileName}: ${err.message}`);
      if (err.message.includes("Google authorization")) {
        console.error("\nGoogle Drive refresh token in Supabase Edge Function secrets has expired.");
        console.error("1. Run: node scripts/authorize-google-drive.mjs");
        console.error("2. Copy the new GOOGLE_REFRESH_TOKEN from .secrets/google-drive.env into Supabase Dashboard -> Edge Functions -> Secrets.");
        console.error("3. Re-run: node scripts/upload-pyqs.mjs");
        process.exit(1);
      }
    }
  }
  console.log(`Done. Uploaded: ${uploaded}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
