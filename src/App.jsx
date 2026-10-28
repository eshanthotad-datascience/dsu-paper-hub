import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Camera, Check, Copy, Download, FileUp, FolderUp, MessageCircle, Moon, Search, Sun, Upload, Volume2, VolumeX } from "lucide-react";
import { getPapers } from "./lib/getpaper";
import { supabase } from "./lib/supabase";
import { uploadPapers } from "./lib/uploadPapers";
import "./App.css";

const semesters = Array.from({ length: 8 }, (_, index) => index + 1);

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
  const [filters, setFilters] = useState({ branch: "", cycle: "", semester: "", year: "", type: "" });
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ branch: "", cycle: "", semester: "", subject: "", code: "", type: "", year: "" });
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
    return papers
      .filter((paper) => paper.file_url && (!needle || `${paper.title} ${paper.subject_code || ""}`.toLowerCase().includes(needle)) && (!filters.branch || paper.branch === filters.branch) && (!filters.cycle || paper.cycle === filters.cycle) && (!filters.semester || String(paper.semester) === filters.semester) && (!filters.year || String(paper.exam_year) === filters.year) && (!filters.type || paper.exam_type === filters.type))
      .slice(0, 6);
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
    } catch (error) {
      setUploadStatus(error.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };
  const resetFilters = () => { setSearch(""); setFilters({ branch: "", cycle: "", semester: "", year: "", type: "" }); };
  const showCycles = () => {
    setPage("browse");
    window.setTimeout(() => document.getElementById("cycles")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };
  const branches = [
    "Computer Science & Engineering (CSE)",
    "CSE - Artificial Intelligence & Machine Learning",
    "CSE - Data Sciences",
    "CSE - Cyber Security",
    "CSE - AI & Data Science",
    "Computer Science & Technology (CST)",
    "Computer Science & Medical Engineering",
    "Artificial Intelligence & Robotics",
    "Electronics & Communication Engineering (ECE)",
    "Aerospace Engineering",
    "Mechanical Engineering",
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
        <button onClick={copyDiscord}><MessageCircle size={18} /> {discordCopied ? "Discord copied" : "Discord: __eshxxn."} <Copy size={15} /></button>
      </div>
    </section>
    <div className="intro-meta"><p>FULL VIDEO · ORIGINAL AUDIO</p><p>{visitorCount === null ? "Loading visitors…" : `${visitorCount.toLocaleString()} visitors`}</p></div>
  </main>;

  return <div className={`app-shell ${theme === "dark" ? "dark-theme" : ""}`}>
    <header className="site-header"><button className="brand" onClick={() => setPage("browse")}><span className="brand-icon"><BookOpen size={20} /></span>DSU Paper Hub</button><nav><button className="theme-button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label="Change colour theme">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><button className={page === "browse" ? "nav-link active" : "nav-link"} onClick={() => setPage("browse")}>Browse papers</button><button className="nav-link" onClick={showCycles}>Cycles</button><button className={page === "upload" ? "nav-link active" : "nav-link"} onClick={() => setPage("upload")}>Upload</button></nav></header>
    {page === "browse" ? <main>
      <section className="browse-hero"><h1>Find the question papers you need</h1><p>Papers shared by Dayananda Sagar University students. Search,<br />preview and download, no login needed.</p><div className="search-box"><Search size={21} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by subject name or code" /><button>Search</button></div></section>
      <section className="library"><div className="paper-search-title"><div><h2>Search papers</h2><p>Filter by branch, cycle, semester, year, or paper type.</p></div><span>Use the search bar above for subject name or code.</span></div><div className="filter-panel"><SelectField label="Branch" value={filters.branch} onChange={setFilter("branch")}><option value="">All branches</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</SelectField><SelectField label="Cycle" value={filters.cycle} onChange={setFilter("cycle")}><option value="">All cycles</option><option>Chemistry cycle</option><option>Physics cycle</option></SelectField><SelectField label="Semester" value={filters.semester} onChange={setFilter("semester")}><option value="">All semesters</option>{semesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}</SelectField><SelectField label="Year" value={filters.year} onChange={setFilter("year")}><option value="">All years</option>{[2026, 2025, 2024, 2023, 2022].map((year) => <option key={year}>{year}</option>)}</SelectField><SelectField label="Paper type" value={filters.type} onChange={setFilter("type")}><option value="">All types</option><option>Mid Semester</option><option>End Semester</option></SelectField><button className="outline-button reset" onClick={resetFilters}>Reset</button></div>
        <div className="section-heading"><h2>Latest papers</h2><span>{loaded ? `Showing ${displayedPapers.length} papers` : "Loading papers..."}</span></div><div className="paper-grid">{displayedPapers.map((paper) => <article className="paper-card" key={paper.id}><div className="card-top"><span className="code-pill">{paper.subject_code || "DSU"}</span><span>{paper.exam_type}</span></div><h3>{paper.title}</h3><p>{paper.branch}<br />Semester {paper.semester} · {paper.exam_year}</p><div className="card-actions"><a className="outline-button" href={paper.file_url || "#"} target={paper.file_url ? "_blank" : undefined} rel="noreferrer">View</a><a className="primary-button" href={paper.file_url || "#"} target={paper.file_url ? "_blank" : undefined} rel="noreferrer"><Download size={17} />Download</a></div></article>)}</div>{!displayedPapers.length && <p className="empty-state">No papers match those filters.</p>}<section id="cycles" className="cycle-section"><div><h2>Browse by cycle</h2><p>Find question papers for Chemistry and Physics cycles.</p></div><div className="cycle-cards"><button className="cycle-card"><strong>Chemistry cycle</strong><small>Browse Chemistry-cycle papers</small><span>→</span></button><button className="cycle-card"><strong>Physics cycle</strong><small>Browse Physics-cycle papers</small><span>→</span></button></div></section></section>
    </main> : <main className="upload-page"><section className="upload-heading"><h1>Share a question paper</h1><p>Help your juniors and classmates. Add the details you know and attach a paper.</p></section><section className="upload-layout"><form className="upload-form" onSubmit={submitUpload}><div className="form-grid"><SelectField label="Branch" value={form.branch} onChange={setFormField("branch")}><option value="">Select branch</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</SelectField><SelectField label="Cycle" value={form.cycle} onChange={setFormField("cycle")}><option value="">Select cycle</option><option>Chemistry cycle</option><option>Physics cycle</option></SelectField><SelectField label="Semester" value={form.semester} onChange={setFormField("semester")}><option value="">Select semester</option>{semesters.map((semester) => <option key={semester}>{semester}</option>)}</SelectField><label className="field"><span>Subject name</span><input value={form.subject} onChange={setFormField("subject")} placeholder="e.g. Data Structures" /></label><label className="field"><span>Subject code <small>(optional)</small></span><input value={form.code} onChange={setFormField("code")} placeholder="e.g. CS201" /></label><SelectField label="Paper type" value={form.type} onChange={setFormField("type")}><option value="">Select type</option><option>Mid Semester</option><option>End Semester</option></SelectField><SelectField label="Exam year" value={form.year} onChange={setFormField("year")}><option value="">Select year</option>{[2026, 2025, 2024, 2023, 2022].map((year) => <option key={year}>{year}</option>)}</SelectField></div><div className="upload-choices"><label className="drop-zone"><input type="file" accept="application/pdf,image/png" onChange={(event) => selectFiles(event.target.files)} /><FileUp size={36} /><strong>{fileName || "Choose a PDF or PNG"}</strong><span>PDF or PNG, up to 10 MB</span><em>Choose file</em></label><label className="folder-zone"><input type="file" webkitdirectory="" directory="" multiple onChange={(event) => selectFiles(event.target.files)} /><FolderUp size={28} /><span>Upload a folder</span><small>Choose a folder with papers</small></label></div>{uploadStatus && <p className="upload-status">{uploadStatus}</p>}<button className="primary-button upload-submit" type="submit" disabled={isUploading}>{isUploading ? "Uploading..." : <><Upload size={18} />Upload paper</>}</button></form><aside className="upload-side"><div className="info-card"><h2>Before you upload</h2>{["Use a clear, readable scan", "Subject code is optional", "PDF, PNG, or one paper folder", "Files are sent directly to DSU Paper Hub storage"].map((item) => <p key={item}><Check size={18} />{item}</p>)}</div><div className="sign-in-card"><h2>Public uploads</h2><p>You can upload without signing in. Please share only genuine question papers.</p></div></aside></section></main>}
    <footer>Made by DSU students, for DSU students. Not an official university website.</footer>
  </div>;
}
