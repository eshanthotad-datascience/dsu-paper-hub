import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, BriefcaseBusiness, Camera, Check, Copy, Download, FileUp, FolderUp, MessageCircle, Moon, Search, Sun, Upload, Volume2, VolumeX } from "lucide-react";
import { getPapers } from "./lib/getpaper";
import { supabase } from "./lib/supabase";
import { uploadPapers } from "./lib/uploadPapers";
import "./App.css";

const semesters = [
  { value: "1", label: "Semester 1 (1st Year)" },
  { value: "2", label: "Semester 2 (1st Year)" },
  { value: "3", label: "Semester 3 (2nd Year)" },
  { value: "4", label: "Semester 4 (2nd Year)" },
  { value: "5", label: "Semester 5 (3rd Year)" },
  { value: "6", label: "Semester 6 (3rd Year)" },
  { value: "7", label: "Semester 7 (4th Year)" },
  { value: "8", label: "Semester 8 (4th Year)" },
];

function SelectField({ label, value, onChange, children }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={onChange}>{children}</select></label>;
}

export default function App() {
  const introVideo = useRef(null);
  const [showIntro, setShowIntro] = useState(true);
  const [discordCopied, setDiscordCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [visitorCount, setVisitorCount] = useState(null);
  const [page, setPage] = useState("browse");
  const [theme, setTheme] = useState("light");
  const [papers, setPapers] = useState([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ branch: "", semester: "", type: "" });
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ branch: "", semester: "", subject: "", code: "", type: "" });
  const [fileName, setFileName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPapers().then((data) => { if (!cancelled && data?.length) setPapers(data); }).catch(() => {}).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const hasVisited = localStorage.getItem("dsu-paper-hub-visitor-recorded") === "true";
    supabase.rpc("record_site_visit", { should_increment: !hasVisited }).then(({ data, error }) => {
      if (!error && typeof data === "number") {
        setVisitorCount(data);
        if (!hasVisited) localStorage.setItem("dsu-paper-hub-visitor-recorded", "true");
      }
    });
  }, []);

  useEffect(() => {
    if (!showIntro || !introVideo.current) return;
    const video = introVideo.current;
    video.muted = false;
    video.volume = 1;
    video.play().then(() => setSoundEnabled(true)).catch(() => {
      video.muted = true;
      video.play().catch(() => {});
      setSoundEnabled(false);
    });
  }, [showIntro]);

  const displayedPapers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return papers.filter((paper) => {
      if (!paper.file_url) return false;
      if (needle) {
        const text = `${paper.title} ${paper.subject_code || ""} ${paper.branch || ""}`.toLowerCase();
        if (!text.includes(needle)) return false;
      }
      if (filters.branch) {
        const isCommon = paper.branch === "All branches" || !paper.branch;
        const matches = paper.branch === filters.branch;
        if (!isCommon && !matches) return false;
      }
      if (filters.semester) {
        if (String(paper.semester || paper.year) !== filters.semester) return false;
      }
      if (filters.type && paper.exam_type !== filters.type) {
        return false;
      }
      return true;
    });
  }, [filters, papers, search]);
  const setFilter = (name) => (event) => setFilters((current) => ({ ...current, [name]: event.target.value }));
  const setFormField = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));
  const selectFiles = (fileList) => {
    const files = Array.from(fileList || []);
    setSelectedFiles(files);
    setFileName(files.length === 1 ? files[0].name : files.length ? `${files.length} files selected` : "");
    setUploadStatus("");
  };
  const submitUpload = async (event) => {
    event.preventDefault();
    setIsUploading(true);
    setUploadStatus("");
    try {
      const count = await uploadPapers({ files: selectedFiles, details: form });
      setUploadStatus(`${count} paper${count === 1 ? "" : "s"} uploaded successfully.`);
      setSelectedFiles([]);
      setFileName("");
      getPapers().then((data) => { if (data?.length) setPapers(data); }).catch(() => {});
    } catch (error) {
      setUploadStatus(error.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };
  const resetFilters = () => { setSearch(""); setFilters({ branch: "", semester: "", type: "" }); };
  const branches = [
    "Computer Science & Engineering (CSE)",
    "Artificial Intelligence & Machine Learning (AIML)",
    "Data Science",
    "Cyber Security",
    "AI & Data Science",
    "Artificial Intelligence & Robotics",
    "Computer Science & Technology (CST)",
    "Electronics & Communication Engineering (ECE)",
    "Aerospace Engineering",
    "Mechanical Engineering",
    "Open Electives (OE)",
    "Institutional Electives",
  ];

  const enableIntroSound = async () => {
    if (!introVideo.current) return;
    if (introVideo.current.ended) introVideo.current.currentTime = 0;
    introVideo.current.muted = false;
    introVideo.current.volume = 1;
    await introVideo.current.play().then(() => setSoundEnabled(true)).catch(() => {});
  };
  const toggleIntroSound = () => {
    if (soundEnabled) {
      if (introVideo.current) introVideo.current.muted = true;
      setSoundEnabled(false);
      return;
    }
    enableIntroSound();
  };
  const leaveIntro = () => {
    introVideo.current?.pause();
    setShowIntro(false);
  };
  const copyDiscord = async () => {
    await navigator.clipboard?.writeText("__eshxxn.");
    setDiscordCopied(true);
    window.setTimeout(() => setDiscordCopied(false), 1800);
  };

  if (showIntro) return <main className="intro-page">
    <video ref={introVideo} className="intro-video" src="/eshxxn-intro.mp4" autoPlay playsInline aria-label="Anime edit background video" />
    <div className="intro-shade" />
    <section className="intro-content">
      <p className="intro-kicker">DSU PAPER HUB</p>
      <h1>MADE BY <span>ESHXXN <i>&amp;</i> ADARXXH</span></h1>
      <p className="intro-branch">CSE BRANCH</p>
      <p className="intro-copy">A student-built space to find and share DSU question papers. Many features will be added in future updates. Stay tuned.</p>
      <div className="intro-actions">
        <button className="intro-enter" onClick={leaveIntro}>Enter Paper Hub <ArrowRight size={18} /></button>
        <button className="intro-sound" onClick={toggleIntroSound}>{soundEnabled ? <VolumeX size={18} /> : <Volume2 size={18} />}{soundEnabled ? "Mute sound" : "Enable sound"}</button>
      </div>
      <div className="intro-socials">
        <a href="https://www.instagram.com/urfavv.eshxxn_/" target="_blank" rel="noreferrer"><Camera size={18} /> ESHXXN Instagram</a>
        <a href="https://www.linkedin.com/in/eshan-thotad-606876282/" target="_blank" rel="noreferrer"><BriefcaseBusiness size={18} /> LinkedIn</a>
        <button onClick={copyDiscord}><MessageCircle size={18} /> {discordCopied ? "Discord copied" : "Discord: __eshxxn."} <Copy size={15} /></button>
      </div>
    </section>
    <div className="intro-meta"><p>FULL VIDEO · ORIGINAL AUDIO</p><p>{visitorCount === null ? "Loading visitors…" : `${visitorCount.toLocaleString()} visitors`}</p></div>
  </main>;

  return <div className={`app-shell ${theme === "dark" ? "dark-theme" : ""}`}>
    <header className="site-header"><button className="brand" onClick={() => setPage("browse")}><span className="brand-icon"><BookOpen size={20} /></span>DSU Paper Hub</button><nav><button className="theme-button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label="Change colour theme">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><button className={page === "browse" ? "nav-link active" : "nav-link"} onClick={() => setPage("browse")}>Browse papers</button><button className={page === "upload" ? "nav-link active" : "nav-link"} onClick={() => setPage("upload")}>Upload</button></nav></header>
    {page === "browse" ? <main>
      <section className="browse-hero"><h1>Find the question papers you need</h1><p>Papers shared by Dayananda Sagar University students. Search,<br />preview and download, no login needed.</p><div className="search-box"><Search size={21} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by subject name or code" /><button>Search</button></div></section>
      <section className="library"><div className="paper-search-title"><div><h2>Search papers</h2><p>Filter by branch, semester, or paper type.</p></div><span>Use the search bar above for subject name, code, or branch.</span></div><div className="filter-panel"><SelectField label="Branch" value={filters.branch} onChange={setFilter("branch")}><option value="">All branches</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</SelectField><SelectField label="Semester" value={filters.semester} onChange={setFilter("semester")}><option value="">All semesters</option>{semesters.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</SelectField><SelectField label="Paper type" value={filters.type} onChange={setFilter("type")}><option value="">All types</option><option>Mid Semester</option><option>End Semester</option></SelectField><button className="outline-button reset" onClick={resetFilters}>Reset</button></div>
        <div className="section-heading"><h2>Latest papers</h2><span>{loaded ? `Showing ${displayedPapers.length} papers` : "Loading papers..."}</span></div><div className="paper-grid">{displayedPapers.map((paper) => <article className="paper-card" key={paper.id}><div className="card-top"><span className="code-pill">{paper.subject_code || "DSU"}</span><span>{paper.exam_year ? `${paper.exam_year} · ` : ""}{paper.exam_type}</span></div><h3>{paper.title}</h3><p>{paper.branch}<br />Semester {paper.semester || 1}{paper.exam_year ? ` (${paper.exam_year})` : ""}</p><div className="card-actions"><a className="outline-button" href={paper.file_url || "#"} target={paper.file_url ? "_blank" : undefined} rel="noreferrer">View</a><a className="primary-button" href={paper.file_url || "#"} target={paper.file_url ? "_blank" : undefined} rel="noreferrer"><Download size={17} />Download</a></div></article>)}</div>{!displayedPapers.length && <p className="empty-state">No papers match those filters.</p>}</section>
    </main> : <main className="upload-page"><section className="upload-heading"><h1>Share a question paper</h1><p>Help your juniors and classmates. Add the details you know and attach a paper.</p></section><section className="upload-layout"><form className="upload-form" onSubmit={submitUpload}><div className="form-grid"><SelectField label="Branch" value={form.branch} onChange={setFormField("branch")}><option value="">Select branch</option><option value="All branches">All branches</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</SelectField><SelectField label="Semester" value={form.semester} onChange={setFormField("semester")}><option value="">Select semester</option>{semesters.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</SelectField><label className="field"><span>Subject name</span><input value={form.subject} onChange={setFormField("subject")} placeholder="e.g. Data Structures" /></label><label className="field"><span>Subject code <small>(optional)</small></span><input value={form.code} onChange={setFormField("code")} placeholder="e.g. CS201" /></label><SelectField label="Paper type" value={form.type} onChange={setFormField("type")}><option value="">Select type</option><option>Mid Semester</option><option>End Semester</option></SelectField></div><div className="upload-choices"><label className="drop-zone"><input type="file" accept="application/pdf,image/png" onChange={(event) => selectFiles(event.target.files)} /><FileUp size={36} /><strong>{fileName || "Choose a PDF or PNG"}</strong><span>PDF or PNG, up to 10 MB</span><em>Choose file</em></label><label className="folder-zone"><input type="file" webkitdirectory="" directory="" multiple onChange={(event) => selectFiles(event.target.files)} /><FolderUp size={28} /><span>Upload a folder</span><small>Choose a folder with papers</small></label></div>{uploadStatus && <p className="upload-status">{uploadStatus}</p>}<button className="primary-button upload-submit" type="submit" disabled={isUploading}>{isUploading ? "Uploading..." : <><Upload size={18} />Upload paper</>}</button></form><aside className="upload-side"><div className="info-card"><h2>Before you upload</h2>{["Use a clear, readable scan", "Subject code is optional", "PDF, PNG, or one paper folder", "Files are sent directly to DSU Paper Hub storage"].map((item) => <p key={item}><Check size={18} />{item}</p>)}</div><div className="sign-in-card"><h2>Public uploads</h2><p>You can upload without signing in. Please share only genuine question papers.</p></div></aside></section></main>}
    <footer>Made by DSU students, for DSU students. Not an official university website.</footer>
  </div>;
}
