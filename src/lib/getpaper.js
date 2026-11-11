import catalogPapers from "../data/papers.json";
import { supabase } from "./supabase";

export async function getPapers({ search = "", year = "" } = {}) {
  const { data } = await supabase
    .from("papers")
    .select("*")
    .order("created_at", { ascending: false })
    .then((result) => result, () => ({ data: [] }));

  const dbPapers = (data || []).map((paper) => ({
    ...paper,
    file_url: paper.drive_url || paper.file_url,
  }));

  const seenDriveIds = new Set(dbPapers.map((p) => p.drive_file_id).filter(Boolean));
  const merged = [
    ...dbPapers,
    ...catalogPapers.filter((p) => !seenDriveIds.has(p.drive_file_id)),
  ];

  return merged.filter((paper) =>
    (!search.trim() || paper.title.toLowerCase().includes(search.trim().toLowerCase()))
    && (year === "" || paper.semester === Number(year) || paper.year === Number(year)),
  );
}
