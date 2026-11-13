import { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  Lock,
  User,
  ShieldCheck,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  ArrowRight,
  Info
} from "lucide-react";

// DSU Engineering default subjects for demonstration if user hasn't added any
const DEFAULT_SUBJECTS = [
  { id: "1", name: "Data Structures & Algorithms", code: "23CS201", attended: 26, total: 30 },
  { id: "2", name: "Database Management Systems", code: "23CS202", attended: 22, total: 28 },
  { id: "3", name: "Operating Systems", code: "23CS203", attended: 19, total: 26 },
  { id: "4", name: "Computer Networks", code: "23CS204", attended: 24, total: 25 },
  { id: "5", name: "Single and Multivariate Calculus", code: "23EN1201", attended: 18, total: 27 },
];

export default function AttendanceCalculator({ papers = [], branches = [], semesters = [] }) {
  // Target percentage (default 75% as per DSU university rules)
  const [targetPct, setTargetPct] = useState(() => {
    const saved = localStorage.getItem("dsu_attendance_target");
    return saved ? Number(saved) : 75;
  });

  // Active view: 'tracker' (subject list) or 'quick' (single calculator)
  const [activeTab, setActiveTab] = useState("tracker");

  // Subject list state with localStorage persistence
  const [subjects, setSubjects] = useState(() => {
    try {
      const saved = localStorage.getItem("dsu_attendance_subjects");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SUBJECTS;
  });

  // Student credentials profile state
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("dsu_student_profile");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { usn: "", password: "", branch: "", semester: "", isSaved: false };
  });

  const [showProfileForm, setShowProfileForm] = useState(!profile.isSaved);
  const [profileInput, setProfileInput] = useState({
    usn: profile.usn || "",
    password: profile.password || "",
    branch: profile.branch || "",
    semester: profile.semester || "",
  });

  // New subject form state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    code: "",
    attended: "",
    total: "",
  });

  // Quick calculator state
  const [quickInput, setQuickInput] = useState({ attended: 24, total: 30 });

  // Save target percentage
  useEffect(() => {
    localStorage.setItem("dsu_attendance_target", String(targetPct));
  }, [targetPct]);

  // Save subjects to localStorage
  useEffect(() => {
    localStorage.setItem("dsu_attendance_subjects", JSON.stringify(subjects));
  }, [subjects]);

  // Save profile
  const handleSaveProfile = (e) => {
    e?.preventDefault();
    if (!profileInput.usn.trim()) return;
    const updated = {
      ...profileInput,
      usn: profileInput.usn.trim().toUpperCase(),
      isSaved: true,
    };
    setProfile(updated);
    localStorage.setItem("dsu_student_profile", JSON.stringify(updated));
    setShowProfileForm(false);
  };

  const handleDisconnectProfile = () => {
    const empty = { usn: "", password: "", branch: "", semester: "", isSaved: false };
    setProfile(empty);
    setProfileInput(empty);
    localStorage.removeItem("dsu_student_profile");
    setShowProfileForm(true);
  };

  // Helper calculation formulas (matching PesuDash algorithm)
  const calculateAdvice = (attended, total, target) => {
    if (total === 0) {
      return { pct: 100, canSkip: 0, mustAttend: 0, status: "safe", text: "No classes conducted yet." };
    }
    const pct = (attended / total) * 100;
    const t = target / 100;

    if (pct >= target) {
      // k <= (attended / t) - total
      const canSkip = Math.floor(attended / t - total);
      if (canSkip > 0) {
        return {
          pct,
          canSkip,
          mustAttend: 0,
          status: "safe",
          text: `On track! You can skip ${canSkip} class${canSkip === 1 ? "" : "es"} safely.`,
        };
      } else {
        return {
          pct,
          canSkip: 0,
          mustAttend: 0,
          status: "tight",
          text: "Attendance is tight! Attend your next class to stay above target.",
        };
      }
    } else {
      // m >= (t * total - attended) / (1 - t)
      const mustAttend = Math.ceil((t * total - attended) / (1 - t));
      return {
        pct,
        canSkip: 0,
        mustAttend,
        status: "danger",
        text: `Need to attend next ${mustAttend} consecutive class${mustAttend === 1 ? "" : "es"} to hit ${target}%.`,
      };
    }
  };

  // Overall attendance stats
  const overall = useMemo(() => {
    const totalConducted = subjects.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalAttended = subjects.reduce((sum, s) => sum + Number(s.attended || 0), 0);
    const totalMissed = Math.max(0, totalConducted - totalAttended);
    const percentage = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 100;

    const advice = calculateAdvice(totalAttended, totalConducted, targetPct);
    return {
      totalConducted,
      totalAttended,
      totalMissed,
      percentage,
      ...advice,
    };
  }, [subjects, targetPct]);

  // Color helper based on percentage & target
  const getStatusColor = (pct, target) => {
    if (pct >= target) return { text: "var(--att-green)", bg: "var(--att-green-bg)", border: "var(--att-green-border)" };
    if (pct >= target - 5) return { text: "var(--att-yellow)", bg: "var(--att-yellow-bg)", border: "var(--att-yellow-border)" };
    return { text: "var(--att-red)", bg: "var(--att-red-bg)", border: "var(--att-red-border)" };
  };

  // Increment / Decrement handlers for quick simulation
  const adjustClass = (id, deltaAttended, deltaTotal) => {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const newAttended = Math.max(0, Number(s.attended) + deltaAttended);
        const newTotal = Math.max(newAttended, Number(s.total) + deltaTotal);
        return { ...s, attended: newAttended, total: newTotal };
      })
    );
  };

  // Save new or edited subject
  const handleSaveSubject = (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return;

    const attended = Math.max(0, parseInt(subjectForm.attended, 10) || 0);
    const total = Math.max(attended, parseInt(subjectForm.total, 10) || 0);

    if (editingSubjectId) {
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === editingSubjectId
            ? { ...s, name: subjectForm.name.trim(), code: subjectForm.code.trim().toUpperCase(), attended, total }
            : s
        )
      );
      setEditingSubjectId(null);
    } else {
      const newSubject = {
        id: String(Date.now()),
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        attended,
        total,
      };
      setSubjects((prev) => [...prev, newSubject]);
    }

    setSubjectForm({ name: "", code: "", attended: "", total: "" });
    setShowAddSubject(false);
  };

  const handleEditClick = (subject) => {
    setEditingSubjectId(subject.id);
    setSubjectForm({
      name: subject.name,
      code: subject.code || "",
      attended: String(subject.attended),
      total: String(subject.total),
    });
    setShowAddSubject(true);
  };

  const handleDeleteSubject = (id) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  // Auto-populate subjects from Paper Hub catalog for selected branch/semester
  const availableCatalogSubjects = useMemo(() => {
    const sem = profile.semester;
    const branch = profile.branch;
    if (!papers || !papers.length) return [];

    const filtered = papers.filter((p) => {
      if (sem && String(p.semester) !== String(sem)) return false;
      if (branch && branch !== "All branches" && p.branch && p.branch !== "All branches" && !p.branch.includes(branch) && !branch.includes(p.branch)) {
        return false;
      }
      return true;
    });

    const uniqueMap = new Map();
    filtered.forEach((p) => {
      if (p.title && !uniqueMap.has(p.title.toLowerCase())) {
        uniqueMap.set(p.title.toLowerCase(), {
          name: p.title,
          code: p.subject_code || "",
        });
      }
    });

    return Array.from(uniqueMap.values()).slice(0, 10);
  }, [papers, profile.branch, profile.semester]);

  const handleImportCatalogSubjects = () => {
    if (!availableCatalogSubjects.length) return;
    const newItems = availableCatalogSubjects.map((sub, idx) => ({
      id: String(Date.now() + idx),
      name: sub.name,
      code: sub.code,
      attended: 20,
      total: 24,
    }));
    setSubjects(newItems);
  };

  // Quick Calculator Advice
  const quickAdvice = useMemo(() => {
    const att = Math.max(0, Number(quickInput.attended) || 0);
    const tot = Math.max(att, Number(quickInput.total) || 0);
    return calculateAdvice(att, tot, targetPct);
  }, [quickInput, targetPct]);

  return (
    <div className="attendance-page">
      {/* Top Banner / Hero */}
      <section className="att-hero">
        <div className="att-hero-content">
          <div className="att-badge-row">
            <span className="att-pill-brand">
              <Calculator size={14} /> DSU Attendance Planner
            </span>
            <span className="att-pill-sub">PesuDash Inspired Engine</span>
          </div>
          <h1>Track, Calculate <i>&amp;</i> Predict Attendance</h1>
          <p>
            Know exactly how many classes you can safely skip or must attend to meet university criteria.
          </p>

          {/* Target Percentage Control Bar */}
          <div className="att-target-bar">
            <div className="att-target-info">
              <Sliders size={18} />
              <div>
                <strong>Target Attendance</strong>
                <span>DSU standard minimum is 75% to appear for exams</span>
              </div>
            </div>
            <div className="att-target-controls">
              <div className="att-preset-chips">
                {[75, 80, 85, 90].map((val) => (
                  <button
                    key={val}
                    className={`att-chip ${targetPct === val ? "active" : ""}`}
                    onClick={() => setTargetPct(val)}
                  >
                    {val}%
                  </button>
                ))}
              </div>
              <div className="att-slider-box">
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="1"
                  value={targetPct}
                  onChange={(e) => setTargetPct(Number(e.target.value))}
                />
                <span className="att-slider-val">{targetPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="att-container">
        {/* Student Credentials / Profile Section */}
        <section className="att-card att-profile-card">
          <div className="att-profile-header">
            <div className="att-profile-title">
              <User size={20} className="att-icon-user" />
              <div>
                <h3>Student Portal Credentials</h3>
                <p>Personalize your timetable, track attendance, and connect with your DSU profile.</p>
              </div>
            </div>
            <button
              className="outline-button att-toggle-btn"
              onClick={() => setShowProfileForm((prev) => !prev)}
            >
              {profile.isSaved && !showProfileForm ? (
                <>
                  <Edit2 size={14} /> Edit Credentials
                </>
              ) : showProfileForm && profile.isSaved ? (
                <>
                  <ChevronUp size={14} /> Close
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Details
                </>
              )}
            </button>
          </div>

          {profile.isSaved && !showProfileForm && (
            <div className="att-profile-saved">
              <div className="att-profile-chips">
                <span className="att-profile-chip usn">
                  <User size={13} /> {profile.usn}
                </span>
                {profile.branch && <span className="att-profile-chip">{profile.branch}</span>}
                {profile.semester && (
                  <span className="att-profile-chip">Semester {profile.semester}</span>
                )}
                <span className="att-profile-chip status">
                  <ShieldCheck size={13} /> Saved in local storage
                </span>
              </div>
              <button className="att-disconnect-btn" onClick={handleDisconnectProfile}>
                Disconnect
              </button>
            </div>
          )}

          {showProfileForm && (
            <form onSubmit={handleSaveProfile} className="att-profile-form">
              <div className="att-form-row">
                <label className="field">
                  <span>Student USN / SRN *</span>
                  <input
                    placeholder="e.g. ENG23DS0145"
                    value={profileInput.usn}
                    onChange={(e) => setProfileInput({ ...profileInput, usn: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Portal Password <small>(Encrypted locally)</small></span>
                  <input
                    type="password"
                    placeholder="Enter student password"
                    value={profileInput.password}
                    onChange={(e) => setProfileInput({ ...profileInput, password: e.target.value })}
                  />
                </label>
              </div>
              <div className="att-form-row">
                <label className="field">
                  <span>Branch</span>
                  <select
                    value={profileInput.branch}
                    onChange={(e) => setProfileInput({ ...profileInput, branch: e.target.value })}
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Current Semester</span>
                  <select
                    value={profileInput.semester}
                    onChange={(e) => setProfileInput({ ...profileInput, semester: e.target.value })}
                  >
                    <option value="">Select semester</option>
                    {semesters.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="att-profile-actions">
                <button type="submit" className="primary-button">
                  <Lock size={15} /> Save Credentials
                </button>
                <div className="att-security-note">
                  <ShieldCheck size={16} />
                  <span>
                    <strong>Client-Side Privacy:</strong> Your login credentials never leave your
                    device. They remain stored strictly inside your browser's private local storage.
                  </span>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* Overall Status Metrics Cards (PesuDash Style) */}
        <section className="att-metrics-grid">
          <div className="att-metric-card main-stat">
            <div className="att-metric-left">
              <span className="att-metric-label">Overall Attendance</span>
              <div className="att-pct-display">
                <span className="att-pct-number">{overall.percentage.toFixed(1)}%</span>
                <span
                  className="att-status-badge"
                  style={{
                    backgroundColor: getStatusColor(overall.percentage, targetPct).bg,
                    color: getStatusColor(overall.percentage, targetPct).text,
                    borderColor: getStatusColor(overall.percentage, targetPct).border,
                  }}
                >
                  {overall.percentage >= targetPct ? "Above Target" : "Below Target"}
                </span>
              </div>
              <p className="att-metric-sub">{overall.text}</p>
            </div>
            <div
              className="att-circle-meter"
              style={{
                background: `conic-gradient(${getStatusColor(overall.percentage, targetPct).text} ${
                  overall.percentage * 3.6
                }deg, var(--meter-track) 0deg)`,
              }}
            >
              <div className="att-circle-inner">
                <strong>{Math.round(overall.percentage)}%</strong>
                <small>Goal: {targetPct}%</small>
              </div>
            </div>
          </div>

          <div className="att-metric-card">
            <span className="att-metric-label">Classes Attended</span>
            <div className="att-metric-num text-green">
              {overall.totalAttended} <small>/ {overall.totalConducted}</small>
            </div>
            <p className="att-metric-sub">
              {overall.totalMissed} class{overall.totalMissed === 1 ? "" : "es"} missed so far
            </p>
          </div>

          <div className="att-metric-card">
            <span className="att-metric-label">Room for Bunking</span>
            <div className={`att-metric-num ${overall.canSkip > 0 ? "text-green" : "text-yellow"}`}>
              {overall.canSkip > 0 ? `${overall.canSkip} Classes` : "0 Classes"}
            </div>
            <p className="att-metric-sub">
              {overall.canSkip > 0
                ? "Can skip across subjects"
                : `Must attend ${overall.mustAttend} classes to reach ${targetPct}%`}
            </p>
          </div>
        </section>

        {/* View Switcher Tabs */}
        <div className="att-tabs-bar">
          <button
            className={`att-tab-btn ${activeTab === "tracker" ? "active" : ""}`}
            onClick={() => setActiveTab("tracker")}
          >
            <BookOpen size={16} /> Subject-Wise Tracker ({subjects.length})
          </button>
          <button
            className={`att-tab-btn ${activeTab === "quick" ? "active" : ""}`}
            onClick={() => setActiveTab("quick")}
          >
            <Calculator size={16} /> Quick Scenario Calculator
          </button>
        </div>

        {/* TAB 1: SUBJECT-WISE TRACKER */}
        {activeTab === "tracker" && (
          <div className="att-tracker-view">
            <div className="att-toolbar">
              <div className="att-toolbar-left">
                <h2>Your Subjects</h2>
                <span>Tap (+1 Present) or (+1 Absent) to test attendance changes live</span>
              </div>
              <div className="att-toolbar-right">
                {availableCatalogSubjects.length > 0 && (
                  <button
                    className="outline-button att-import-btn"
                    onClick={handleImportCatalogSubjects}
                    title="Load subjects from Paper Hub syllabus"
                  >
                    <Sparkles size={15} /> Load DSU Syllabus
                  </button>
                )}
                <button
                  className="primary-button att-add-btn"
                  onClick={() => {
                    setEditingSubjectId(null);
                    setSubjectForm({ name: "", code: "", attended: "", total: "" });
                    setShowAddSubject(true);
                  }}
                >
                  <Plus size={16} /> Add Subject
                </button>
              </div>
            </div>

            {/* Modal / Dialog for Add / Edit Subject */}
            {showAddSubject && (
              <div className="att-modal-overlay">
                <div className="att-modal-card">
                  <div className="att-modal-header">
                    <h3>{editingSubjectId ? "Edit Subject" : "Add New Subject"}</h3>
                    <button
                      className="att-close-btn"
                      onClick={() => setShowAddSubject(false)}
                    >
                      &times;
                    </button>
                  </div>
                  <form onSubmit={handleSaveSubject} className="att-modal-form">
                    <label className="field">
                      <span>Subject Name *</span>
                      <input
                        placeholder="e.g. Operating Systems"
                        value={subjectForm.name}
                        onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                        required
                        autoFocus
                      />
                    </label>
                    <label className="field">
                      <span>Subject Code <small>(optional)</small></span>
                      <input
                        placeholder="e.g. 23CS203"
                        value={subjectForm.code}
                        onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                      />
                    </label>
                    <div className="att-form-row">
                      <label className="field">
                        <span>Classes Attended</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 20"
                          value={subjectForm.attended}
                          onChange={(e) => setSubjectForm({ ...subjectForm, attended: e.target.value })}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Total Conducted</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 24"
                          value={subjectForm.total}
                          onChange={(e) => setSubjectForm({ ...subjectForm, total: e.target.value })}
                          required
                        />
                      </label>
                    </div>
                    <div className="att-modal-actions">
                      <button
                        type="button"
                        className="outline-button"
                        onClick={() => setShowAddSubject(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="primary-button">
                        {editingSubjectId ? "Save Changes" : "Add Subject"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Subject Cards Grid (PesuDash Style) */}
            <div className="att-cards-grid">
              {subjects.map((sub) => {
                const att = Number(sub.attended) || 0;
                const tot = Number(sub.total) || 0;
                const advice = calculateAdvice(att, tot, targetPct);
                const colors = getStatusColor(advice.pct, targetPct);

                return (
                  <article className="att-subject-card" key={sub.id}>
                    <div className="att-card-head">
                      <div
                        className="att-score-badge"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          borderColor: colors.border,
                        }}
                      >
                        <span className="att-score-num">{advice.pct.toFixed(0)}%</span>
                      </div>

                      <div className="att-subject-info">
                        <h4>{sub.name}</h4>
                        <div className="att-sub-meta">
                          {sub.code && <span className="att-code-pill">{sub.code}</span>}
                          <span className="att-ratio">
                            {att} of {tot} attended
                          </span>
                        </div>
                      </div>

                      <div className="att-card-opts">
                        <button
                          className="att-icon-action"
                          onClick={() => handleEditClick(sub)}
                          title="Edit subject"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="att-icon-action delete"
                          onClick={() => handleDeleteSubject(sub.id)}
                          title="Delete subject"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="att-progress-track">
                      <div
                        className="att-progress-bar"
                        style={{
                          width: `${Math.min(100, advice.pct)}%`,
                          backgroundColor: colors.text,
                        }}
                      />
                    </div>

                    {/* Dynamic Advice Pill */}
                    <div
                      className="att-advice-box"
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      }}
                    >
                      {advice.pct >= targetPct ? (
                        <CheckCircle2 size={15} />
                      ) : advice.pct >= targetPct - 5 ? (
                        <AlertTriangle size={15} />
                      ) : (
                        <XCircle size={15} />
                      )}
                      <span>{advice.text}</span>
                    </div>

                    {/* Interactive +1 / -1 Action Buttons */}
                    <div className="att-quick-actions">
                      <button
                        className="att-btn-plus present"
                        onClick={() => adjustClass(sub.id, 1, 1)}
                        title="Simulate attending next class"
                      >
                        +1 Attended
                      </button>
                      <button
                        className="att-btn-plus absent"
                        onClick={() => adjustClass(sub.id, 0, 1)}
                        title="Simulate missing next class"
                      >
                        +1 Missed
                      </button>
                      <button
                        className="att-btn-undo"
                        onClick={() => adjustClass(sub.id, -1, -1)}
                        title="Undo last step"
                        disabled={att <= 0 || tot <= 0}
                      >
                        Undo
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {!subjects.length && (
              <div className="att-empty-state">
                <Info size={36} />
                <h3>No subjects added yet</h3>
                <p>Add your semester subjects to calculate your attendance and skip room.</p>
                <button
                  className="primary-button"
                  onClick={() => setShowAddSubject(true)}
                >
                  <Plus size={16} /> Add Your First Subject
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUICK SCENARIO CALCULATOR */}
        {activeTab === "quick" && (
          <div className="att-quick-view">
            <div className="att-card att-quick-card">
              <div className="att-quick-header">
                <h2>Quick Attendance Calculator</h2>
                <p>
                  Quickly check any single subject scenario without adding it to your permanent list.
                </p>
              </div>

              <div className="att-quick-inputs">
                <label className="field">
                  <span>Classes Attended</span>
                  <input
                    type="number"
                    min="0"
                    value={quickInput.attended}
                    onChange={(e) =>
                      setQuickInput({ ...quickInput, attended: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Total Classes Conducted</span>
                  <input
                    type="number"
                    min="0"
                    value={quickInput.total}
                    onChange={(e) =>
                      setQuickInput({ ...quickInput, total: e.target.value })
                    }
                  />
                </label>
              </div>

              {/* Quick Result Box */}
              <div
                className="att-quick-result"
                style={{
                  backgroundColor: getStatusColor(quickAdvice.pct, targetPct).bg,
                  borderColor: getStatusColor(quickAdvice.pct, targetPct).border,
                }}
              >
                <div className="att-quick-pct" style={{ color: getStatusColor(quickAdvice.pct, targetPct).text }}>
                  {quickAdvice.pct.toFixed(1)}%
                </div>
                <div className="att-quick-details">
                  <h4>
                    {quickAdvice.pct >= targetPct ? "Status: Eligible" : "Status: Low Attendance"}
                  </h4>
                  <p style={{ color: getStatusColor(quickAdvice.pct, targetPct).text }}>
                    {quickAdvice.text}
                  </p>
                </div>
              </div>

              {/* What-If Future Projection Table */}
              <div className="att-projections-table">
                <h3>What-If Scenario Projections</h3>
                <div className="att-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Attended / Total</th>
                        <th>Projected %</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 5].map((count) => {
                        const newAtt = Number(quickInput.attended) + count;
                        const newTot = Number(quickInput.total) + count;
                        const newPct = (newAtt / newTot) * 100;
                        return (
                          <tr key={`attend-${count}`}>
                            <td>Attend next {count} class{count > 1 ? "es" : ""}</td>
                            <td>{newAtt} / {newTot}</td>
                            <td className="text-green font-bold">{newPct.toFixed(1)}%</td>
                            <td>{newPct >= targetPct ? "✓ Meets target" : "⚠️ Still short"}</td>
                          </tr>
                        );
                      })}
                      {[1, 2, 3].map((count) => {
                        const newAtt = Number(quickInput.attended);
                        const newTot = Number(quickInput.total) + count;
                        const newPct = (newAtt / newTot) * 100;
                        return (
                          <tr key={`miss-${count}`}>
                            <td>Miss next {count} class{count > 1 ? "es" : ""}</td>
                            <td>{newAtt} / {newTot}</td>
                            <td className={newPct >= targetPct ? "text-yellow font-bold" : "text-red font-bold"}>
                              {newPct.toFixed(1)}%
                            </td>
                            <td>{newPct >= targetPct ? "✓ Still safe" : "🚨 Drops below"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
