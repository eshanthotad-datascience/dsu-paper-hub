import { supabase } from "./supabase";

const allowedTypes = new Set(["application/pdf", "image/png"]);
const maxFileSize = 10 * 1024 * 1024;

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadPapers({ files, details }) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) throw new Error("Choose at least one PDF or PNG file.");
  const year = details.year || details.semester;
  if (!details.branch || !year || !details.subject || !details.type) {
    throw new Error("Please complete branch, year, subject name, and paper type.");
  }
  if (selectedFiles.some((file) => !allowedTypes.has(file.type) || file.size === 0 || file.size > maxFileSize)) {
    throw new Error("Each file must be a PDF or PNG smaller than 10 MB.");
  }

  const batchId = crypto.randomUUID();
  const examYear = Number(details.exam_year) || new Date().getFullYear();
  const rows = [];

  for (const file of selectedFiles) {
    const objectPath = `uploads/${batchId}/${safeName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("papers")
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      throw new Error(uploadError.message || "Could not upload file to storage.");
    }

    const { data: urlData } = supabase.storage.from("papers").getPublicUrl(objectPath);
    rows.push({
      title: selectedFiles.length === 1 ? details.subject.trim() : `${details.subject.trim()} - ${file.name}`,
      subject_code: (details.code || "").trim() || null,
      branch: details.branch,
      cycle: null,
      semester: Number(year),
      exam_year: examYear,
      exam_type: details.type,
      drive_file_id: objectPath,
      drive_url: urlData.publicUrl,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      upload_batch_id: batchId,
    });
  }

  const { error: insertError } = await supabase.from("papers").insert(rows);
  if (insertError) {
    throw new Error(insertError.message || "Could not save paper details.");
  }

  return rows.length;
}
