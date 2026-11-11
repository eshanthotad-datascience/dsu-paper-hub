import { supabase } from "./supabase";

export async function getPapers({ search = "", year = "" } = {}) {
  const { data, error } = await supabase.functions.invoke("list-papers", { method: "GET" });
  if (error) throw error;

  return (data?.papers || []).filter((paper) =>
    (!search.trim() || paper.title.toLowerCase().includes(search.trim().toLowerCase()))
    && (year === "" || paper.semester === Number(year) || paper.year === Number(year)),
  );
}
