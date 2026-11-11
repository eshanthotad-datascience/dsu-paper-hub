import { supabase } from "./supabase";

export async function getPapers({ search = "", year = "" } = {}) {
  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || [])
    .map((paper) => ({ ...paper, file_url: paper.drive_url || paper.file_url }))
    .filter((paper) =>
      (!search.trim() || paper.title.toLowerCase().includes(search.trim().toLowerCase()))
      && (year === "" || paper.semester === Number(year) || paper.year === Number(year)),
    );
}
