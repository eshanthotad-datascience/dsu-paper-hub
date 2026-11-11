import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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
        folder: entry.name,
        examYear,
        subjectCode,
        title,
      });
    }
  }
  return results;
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

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: existing, error: fetchError } = await supabase.from("papers").select("file_name");
  if (fetchError) throw new Error(fetchError.message);
  const existingNames = new Set((existing || []).map((e) => e.file_name));

  const batchId = crypto.randomUUID();
  let uploaded = 0;
  let skipped = 0;

  for (const paper of pdfs) {
    if (existingNames.has(paper.fileName)) {
      console.log(`SKIP (already in DB): ${paper.fileName}`);
      skipped++;
      continue;
    }

    const buffer = fs.readFileSync(paper.fullPath);
    const objectPath = `pyqs/${paper.examYear}/${crypto.randomUUID().slice(0, 8)}-${safeName(paper.fileName)}`;

    const { error: uploadError } = await supabase.storage
      .from("papers")
      .upload(objectPath, buffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error(`STORAGE ERROR on ${paper.fileName}: ${uploadError.message}`);
      console.error("Make sure you ran supabase/migrations/20261111_supabase_storage.sql in Supabase Dashboard -> SQL Editor.");
      process.exit(1);
    }

    const { data: urlData } = supabase.storage.from("papers").getPublicUrl(objectPath);
    const { error: insertError } = await supabase.from("papers").insert({
      title: paper.title,
      subject_code: paper.subjectCode || null,
      branch: "All branches",
      cycle: null,
      semester: 1,
      exam_year: paper.examYear,
      exam_type: "End Semester",
      drive_file_id: objectPath,
      drive_url: urlData.publicUrl,
      file_name: paper.fileName,
      file_type: "application/pdf",
      file_size: buffer.length,
      upload_batch_id: batchId,
    });

    if (insertError) {
      console.error(`DB INSERT ERROR on ${paper.fileName}: ${insertError.message}`);
      console.error("Make sure you ran supabase/migrations/20261111_supabase_storage.sql in Supabase Dashboard -> SQL Editor.");
      process.exit(1);
    }

    uploaded++;
    console.log(`[${uploaded}/${pdfs.length}] Uploaded: ${paper.subjectCode} - ${paper.title}`);
  }

  console.log(`Done. Uploaded: ${uploaded}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
