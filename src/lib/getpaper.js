import catalogPapers from "../data/papers.json";
import { supabase } from "./supabase";

export async function getPapers({ search = "", semester = "", year = "" } = {}) {
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

  const targetSem = semester || year;

  return merged.filter((paper) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const txt = `${paper.title} ${paper.subject_code || ""} ${paper.branch || ""}`.toLowerCase();
      if (!txt.includes(q)) return false;
    }
    if (targetSem !== "") {
      const semNum = Number(targetSem);
      if (paper.semester !== semNum && paper.year !== semNum) return false;
    }
    return true;
  });
}
