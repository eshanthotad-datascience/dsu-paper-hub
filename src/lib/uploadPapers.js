import { supabase } from "./supabase";

const allowedTypes = new Set(["application/pdf", "image/png"]);
const maxFileSize = 10 * 1024 * 1024;

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
  const form = new FormData();
  for (const file of selectedFiles) form.append("files", file);
  form.append("title", details.subject.trim());
  form.append("subject_code", (details.code || "").trim());
  form.append("branch", details.branch);
  form.append("cycle", "");
  form.append("semester", String(year));
  form.append("exam_year", String(details.exam_year || new Date().getFullYear()));
  form.append("exam_type", details.type);
  const { data, error } = await supabase.functions.invoke("upload-paper", { body: form });
  if (error) {
    let message = "The upload service could not complete your request.";
    if (error.context instanceof Response) {
      const responseBody = await error.context.json().catch(() => null);
      if (responseBody?.error) message = responseBody.error;
    }
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || "Upload failed.");
  return data.count;
}
