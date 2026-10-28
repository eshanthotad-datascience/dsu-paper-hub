import { supabase } from "./supabase";

export async function getPapers({ search = "", semester = "" } = {}) {
  let query = supabase
    .from("papers")
    .select("*")
    .not("drive_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  if (semester !== "") {
    query = query.eq("semester", Number(semester));
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((paper) => ({ ...paper, file_url: paper.drive_url }));
}
