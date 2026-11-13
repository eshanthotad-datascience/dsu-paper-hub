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
  Info,
  Calendar,
  Clock,
  Flame,
  GraduationCap
} from "lucide-react";
import { fetchAttendance, clearAttendanceCache } from "../lib/erpClient";
import {
  calculatePercentage,
  calculateOverallAttendance,
  calculateStaticAdvice,
  calculateCalendarProjection
} from "../lib/attendanceCalculations";
import academicCalendar from "../data/academicCalendar.json";

// Authoritative verified courses from Dayananda Sagar University ERP (GNUMS)
const DEFAULT_DEMO_SUBJECTS = [
  { id: "26EN1101_theory", code: "26EN1101", name: "LINEAR ALGEBRA AND DATA FOUNDATIONS (Theory)", baseName: "LINEAR ALGEBRA AND DATA FOUNDATIONS", slotType: "Theory", conducted: 5, attended: 4, absent: 1, total: 5, percentage: 80.0 },
  { id: "26EN1102_practical", code: "26EN1102", name: "ENGINEERING CHEMISTRY FOR CS CLUSTER (Practical)", baseName: "ENGINEERING CHEMISTRY FOR CS CLUSTER", slotType: "Practical", conducted: 8, attended: 7, absent: 1, total: 8, percentage: 87.5 },
  { id: "26EN1102_theory", code: "26EN1102", name: "ENGINEERING CHEMISTRY FOR CS CLUSTER (Theory)", baseName: "ENGINEERING CHEMISTRY FOR CS CLUSTER", slotType: "Theory", conducted: 16, attended: 10, absent: 6, total: 16, percentage: 62.5 },
  { id: "26EN1105_practical", code: "26EN1105", name: "ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER (Practical)", baseName: "ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER", slotType: "Practical", conducted: 9, attended: 8, absent: 1, total: 9, percentage: 88.89 },
  { id: "26EN1105_theory", code: "26EN1105", name: "ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER (Theory)", baseName: "ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER", slotType: "Theory", conducted: 20, attended: 20, absent: 0, total: 20, percentage: 100.0 },
  { id: "26EN1107_practical", code: "26EN1107", name: "ENGINEERING SCIENCE COURSE II FOR CS - INTRODUCTION TO C (Practical)", baseName: "ENGINEERING SCIENCE COURSE II FOR CS - INTRODUCTION TO C", slotType: "Practical", conducted: 1, attended: 1, absent: 0, total: 1, percentage: 100.0 },
  { id: "26EN1111_theory", code: "26EN1111", name: "ENVIRONMENTAL SCIENCE (Theory)", baseName: "ENVIRONMENTAL SCIENCE", slotType: "Theory", conducted: 17, attended: 11, absent: 6, total: 17, percentage: 64.71 },
  { id: "26EN1112_theory", code: "26EN1112", name: "INDIAN CONSTITUTION & LAW (Theory)", baseName: "INDIAN CONSTITUTION & LAW", slotType: "Theory", conducted: 2, attended: 2, absent: 0, total: 2, percentage: 100.0 },
];

// Default personalized weekly class timetable parsed from DSU ERP portal
const DEFAULT_TIMETABLE = {
  academicYear: "2026-2027",
  lastWorkingDay: "2026-12-19",
  semesterEndDate: "2026-12-24",
  totalWeeklyClasses: 11,
  approxRemainingClasses: 56,
  weeklyHoursByCourse: {
    "26EN1105": 2,
    "26EN1111": 2,
    "26EN1110": 1,
    "26EN1107": 2,
    "26EN1102": 2,
    "26EN1101": 1,
    "26EN1112": 1,
  },
  scheduleByDay: {
    Monday: [
      { code: "26EN1107", title: "ENGINEERING SCIENCE COURSE II - INTRO TO C", time: "09:30 AM to 10:30 AM", slotType: "Theory" },
      { code: "26EN1111", title: "ENVIRONMENTAL SCIENCE", time: "11:50 AM to 12:40 PM", slotType: "Theory" },
      { code: "26EN1102", title: "ENGINEERING CHEMISTRY FOR CS CLUSTER", time: "02:45 PM to 03:35 PM", slotType: "Practical" },
    ],
    Tuesday: [
      { code: "26EN1101", title: "LINEAR ALGEBRA AND DATA FOUNDATIONS", time: "11:50 AM to 12:40 PM", slotType: "Theory" },
      { code: "26EN1107", title: "ENGINEERING SCIENCE COURSE II - INTRO TO C", time: "12:40 PM to 01:30 PM", slotType: "Theory" },
    ],
    Wednesday: [
      { code: "26EN1105", title: "ENGINEERING GRAPHICS & GENERATIVE DESIGN", time: "08:30 AM to 09:30 AM", slotType: "Theory" },
      { code: "26EN1102", title: "ENGINEERING CHEMISTRY FOR CS CLUSTER", time: "09:30 AM to 10:30 AM", slotType: "Theory" },
      { code: "26EN1105", title: "ENGINEERING GRAPHICS & GENERATIVE DESIGN", time: "11:50 AM to 12:40 PM", slotType: "Theory" },
      { code: "26EN1112", title: "INDIAN CONSTITUTION & LAW", time: "12:40 PM to 01:30 PM", slotType: "Theory" },
    ],
    Thursday: [
      { code: "26EN1111", title: "ENVIRONMENTAL SCIENCE", time: "08:30 AM to 09:30 AM", slotType: "Theory" },
    ],
    Friday: [
      { code: "26EN1110", title: "DESIGN STUDIO I: ENGINEERING PROBLEM SOLVING", time: "08:30 AM to 09:30 AM", slotType: "Theory" },
    ],
    Saturday: [],
  },
};

export default function AttendanceCalculator({ papers = [], branches = [], semesters = [] }) {
  // Target percentage (default 75% as per DSU university rules)
  const [targetPct, setTargetPct] = useState(() => {
    const saved = localStorage.getItem("dsu_attendance_target");
    return saved ? Number(saved) : 75;
  });

  // Active view: 'tracker' (subject list) or 'quick' (single calculator)
  const [activeTab, setActiveTab] = useState("tracker");

  // Student credentials profile state
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("dsu_student_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.usn && parsed.usn !== "ENG23DS0145" && parsed.studentName) {
          return parsed;
        }
      }
    } catch {}
    return {
      usn: "26UGENG2182",
      password: "6$0$75659N",
      studentName: "ESHAN SUBASH THOTAD",
      branch: "Computer Science & Engineering (CSE)",
      semester: "1",
      isSaved: true,
    };
  });

  const [showProfileForm, setShowProfileForm] = useState(!profile.isSaved);
  const [profileInput, setProfileInput] = useState({
    usn: profile.usn || "26UGENG2182",
    password: profile.password || "6$0$75659N",
    branch: profile.branch || "Computer Science & Engineering (CSE)",
    semester: profile.semester || "1",
  });

  // ERP Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [lastSyncedTime, setLastSyncedTime] = useState(() => {
    return localStorage.getItem("dsu_attendance_last_synced") || "Verified";
  });

  // Subject list state with legacy cache purging
  const [subjects, setSubjects] = useState(() => {
    try {
      const saved = localStorage.getItem("dsu_attendance_subjects");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Purge legacy demo subjects (e.g. 23CS201 or Data Structures) so user sees their actual attendance
        const hasLegacy = parsed.some(
          (s) => s.code === "23CS201" || s.name?.includes("Data Structures") || s.id === "1"
        );
        if (!hasLegacy && Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_DEMO_SUBJECTS;
  });

  // Modal / form states for manual editing
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    code: "",
    slotType: "Theory",
    attended: "",
    total: "",
  });

  // Quick scenario calculator state
  const [quickInput, setQuickInput] = useState({ attended: 63, total: 78 });

  // History state for undo functionality: { [subjectId]: [{ attended, total }] }
  const [history, setHistory] = useState({});

  // Personalized weekly timetable from DSU ERP
  const [timetable, setTimetable] = useState(() => {
    try {
      const saved = localStorage.getItem("dsu_attendance_timetable");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TIMETABLE;
  });
  const [showTimetable, setShowTimetable] = useState(false);

  // Persist target percentage
  useEffect(() => {
    localStorage.setItem("dsu_attendance_target", String(targetPct));
  }, [targetPct]);

  // Persist subjects
  useEffect(() => {
    localStorage.setItem("dsu_attendance_subjects", JSON.stringify(subjects));
  }, [subjects]);

  // Handle DSU ERP live synchronization
  const handleSyncErp = async (e, customCreds = null) => {
    if (e?.preventDefault) e.preventDefault();
    setSyncError(null);
    setSyncSuccess(null);

    const creds = customCreds || {
      username: profileInput.usn.trim(),
      password: profileInput.password,
    };

    if (!creds.username) {
      setSyncError("Please enter your Student USN / SRN.");
      return;
    }
    if (!creds.password) {
      setSyncError("Please enter your DSU ERP portal password.");
      return;
    }

    setIsSyncing(true);

    try {
      const result = await fetchAttendance(
        { username: creds.username, password: creds.password },
        { bypassCache: true }
      );

      if (!result.success) {
        setSyncError(result.error || "Failed to authenticate with DSU ERP. Please check credentials.");
        setIsSyncing(false);
        return;
      }

      // Format subjects from ERP response
      const erpSubjects = (result.subjects || []).map((s) => ({
        id: s.id || `${s.code || "sub"}_${(s.slotType || "theory").toLowerCase()}`,
        code: s.code || "",
        name: s.name || s.baseName || "Subject",
        baseName: s.baseName || s.name || "Subject",
        slotType: s.slotType || "Theory",
        attended: Number(s.attended) || 0,
        total: Number(s.conducted) || 0,
        conducted: Number(s.conducted) || 0,
        percentage: Number(s.percentage) || 0,
      }));

      if (erpSubjects.length > 0) {
        setSubjects(erpSubjects);
      }

      const studentName = result.studentName || profile.studentName || "DSU Student";
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const updatedProfile = {
        ...profileInput,
        usn: creds.username.toUpperCase(),
        password: creds.password,
        studentName,
        isSaved: true,
      };

      setProfile(updatedProfile);
      setLastSyncedTime(nowStr);
      setShowProfileForm(false);
      localStorage.setItem("dsu_student_profile", JSON.stringify(updatedProfile));
      localStorage.setItem("dsu_attendance_last_synced", nowStr);

      if (result.timetable) {
        setTimetable(result.timetable);
        localStorage.setItem("dsu_attendance_timetable", JSON.stringify(result.timetable));
      }

      setSyncSuccess(
        `Successfully synced ${erpSubjects.length} subjects for ${studentName} (${creds.username.toUpperCase()}) from DSU ERP.`
      );
    } catch (err) {
      setSyncError(`Error communicating with DSU ERP: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect profile and reset session
  const handleDisconnectProfile = () => {
    const empty = {
      usn: "",
      password: "",
      studentName: "",
      branch: "",
      semester: "",
      isSaved: false,
    };
    setProfile(empty);
    setProfileInput(empty);
    setSyncSuccess(null);
    setSyncError(null);
    setLastSyncedTime(null);
    clearAttendanceCache();
    localStorage.removeItem("dsu_student_profile");
    localStorage.removeItem("dsu_attendance_last_synced");
    localStorage.removeItem("dsu_attendance_timetable");
    setShowProfileForm(true);
  };

  // Overall statistics derived from subjects using authoritative mathematical functions
  const overall = useMemo(() => {
    const totalConducted = subjects.reduce((sum, s) => sum + Number(s.total ?? s.conducted ?? 0), 0);
    const totalAttended = subjects.reduce((sum, s) => sum + Number(s.attended ?? 0), 0);
    const totalMissed = Math.max(0, totalConducted - totalAttended);
    const percentage = calculatePercentage(totalAttended, totalConducted);

    const advice = calculateStaticAdvice(totalAttended, totalConducted, targetPct);

    // Exact scheduled remaining classes until last working day (Dec 19, 2026) based on ERP timetable
    const futureSlots = timetable?.approxRemainingClasses || 56;
    const calendarProjection = calculateCalendarProjection({
      attended: totalAttended,
      conducted: totalConducted,
      futureSlots,
      targetPct,
    });

    return {
      totalConducted,
      totalAttended,
      totalMissed,
      percentage,
      canSkip: advice.canSkip,
      mustAttend: advice.classesNeeded,
      status: advice.status,
      adviceText: advice.adviceText,
      calendarProjection,
    };
  }, [subjects, targetPct, timetable]);

  // Color helper based on percentage & target
  const getStatusColor = (pct, target) => {
    if (pct >= target) {
      return {
        text: "var(--att-green)",
        bg: "var(--att-green-bg)",
        border: "var(--att-green-border)",
      };
    }
    if (pct >= target - 5) {
      return {
        text: "var(--att-yellow)",
        bg: "var(--att-yellow-bg)",
        border: "var(--att-yellow-border)",
      };
    }
    return {
      text: "var(--att-red)",
      bg: "var(--att-red-bg)",
      border: "var(--att-red-border)",
    };
  };

  // Interactive +1 attended, +1 missed, and undo simulations
  const adjustClass = (id, deltaAttended, deltaTotal) => {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const curAtt = Number(s.attended) || 0;
        const curTot = Number(s.total ?? s.conducted) || 0;

        // Push current state to history
        setHistory((h) => ({
          ...h,
          [id]: [...(h[id] || []), { attended: curAtt, total: curTot }],
        }));

        const newAttended = Math.max(0, curAtt + deltaAttended);
        const newTotal = Math.max(newAttended, curTot + deltaTotal);
        const newPct = calculatePercentage(newAttended, newTotal);

        return {
          ...s,
          attended: newAttended,
          total: newTotal,
          conducted: newTotal,
          percentage: newPct,
        };
      })
    );
  };

  const undoAdjustClass = (id) => {
    const subHistory = history[id];
    if (!subHistory || subHistory.length === 0) return;

    const previous = subHistory[subHistory.length - 1];
    setHistory((h) => ({
      ...h,
      [id]: subHistory.slice(0, -1),
    }));

    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const newPct = calculatePercentage(previous.attended, previous.total);
        return {
          ...s,
          attended: previous.attended,
          total: previous.total,
          conducted: previous.total,
          percentage: newPct,
        };
      })
    );
  };

  // Save new or edited subject
  const handleSaveSubject = (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return;

    const attended = Math.max(0, parseInt(subjectForm.attended, 10) || 0);
    const total = Math.max(attended, parseInt(subjectForm.total, 10) || 0);
    const percentage = calculatePercentage(attended, total);

    if (editingSubjectId) {
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === editingSubjectId
            ? {
                ...s,
                name: subjectForm.name.trim(),
                code: subjectForm.code.trim().toUpperCase(),
                slotType: subjectForm.slotType || "Theory",
                attended,
                total,
                conducted: total,
                percentage,
              }
            : s
        )
      );
      setEditingSubjectId(null);
    } else {
      const newSubject = {
        id: `manual_${Date.now()}`,
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        slotType: subjectForm.slotType || "Theory",
        attended,
        total,
        conducted: total,
        percentage,
      };
      setSubjects((prev) => [...prev, newSubject]);
    }

    setSubjectForm({ name: "", code: "", slotType: "Theory", attended: "", total: "" });
    setShowAddSubject(false);
  };

  const handleEditClick = (subject) => {
    setEditingSubjectId(subject.id);
    setSubjectForm({
      name: subject.name,
      code: subject.code || "",
      slotType: subject.slotType || "Theory",
      attended: String(subject.attended),
      total: String(subject.total ?? subject.conducted ?? ""),
    });
    setShowAddSubject(true);
  };

  const handleDeleteSubject = (id) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  // Quick Calculator Advice
  const quickAdvice = useMemo(() => {
    const att = Math.max(0, Number(quickInput.attended) || 0);
    const tot = Math.max(att, Number(quickInput.total) || 0);
    return calculateStaticAdvice(att, tot, targetPct);
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
            <span className="att-pill-sub">Live DSU ERP Integration</span>
            <span className="att-pill-sub" style={{ opacity: 0.75 }}>• Multi-Branch Agnostic</span>
          </div>

          <h1>Track, Calculate <i>&amp;</i> Predict DSU Attendance</h1>
          <p>
            Connect directly with your Dayananda Sagar University ERP portal to fetch your live courses,
            calculate safe bunking limits, and simulate your attendance trajectory.
          </p>

          {/* Target Percentage Control Bar */}
          <div className="att-target-bar">
            <div className="att-target-info">
              <Sliders size={18} />
              <div>
                <strong>Target Attendance Requirement</strong>
                <span>DSU standard minimum is 75% to be eligible for semester-end examinations</span>
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
        {/* Status / Error Alerts */}
        {syncError && (
          <div
            className="att-alert-banner error"
            style={{
              background: "var(--att-red-bg)",
              border: "1px solid var(--att-red-border)",
              color: "var(--att-red)",
              padding: "14px 18px",
              borderRadius: "12px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <AlertTriangle size={20} />
            <div style={{ flex: 1 }}>
              <strong>DSU ERP Connection Notice:</strong> {syncError}
            </div>
            <button
              onClick={() => setSyncError(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "16px" }}
            >
              &times;
            </button>
          </div>
        )}

        {syncSuccess && (
          <div
            className="att-alert-banner success"
            style={{
              background: "var(--att-green-bg)",
              border: "1px solid var(--att-green-border)",
              color: "var(--att-green)",
              padding: "14px 18px",
              borderRadius: "12px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <CheckCircle2 size={20} />
            <div style={{ flex: 1 }}>{syncSuccess}</div>
            <button
              onClick={() => setSyncSuccess(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "16px" }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Student Credentials / DSU ERP Sync Section */}
        <section className="att-card att-profile-card">
          <div className="att-profile-header">
            <div className="att-profile-title">
              <User size={20} className="att-icon-user" />
              <div>
                <h3>
                  {profile.studentName
                    ? `${profile.studentName}`
                    : "DSU ERP Student Portal"}
                </h3>
                <p>
                  {profile.isSaved
                    ? `Connected as ${profile.usn} • Live synchronization active`
                    : "Enter your Dayananda Sagar University student credentials to pull your live registered subjects."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {profile.isSaved && (
                <button
                  className="primary-button"
                  style={{ padding: "8px 16px", fontSize: "13px", display: "inline-flex", gap: "6px", alignItems: "center" }}
                  onClick={(e) => handleSyncErp(e, { username: profile.usn, password: profile.password })}
                  disabled={isSyncing}
                >
                  <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Syncing..." : "Re-sync ERP"}
                </button>
              )}

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
                    <ChevronDown size={14} /> Portal Login
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Profile Info Pills */}
          {profile.isSaved && !showProfileForm && (
            <div className="att-profile-saved">
              <div className="att-profile-chips">
                <span className="att-profile-chip usn">
                  <User size={13} /> {profile.usn}
                </span>
                {profile.studentName && (
                  <span className="att-profile-chip" style={{ fontWeight: 600 }}>
                    <GraduationCap size={13} /> {profile.studentName}
                  </span>
                )}
                {lastSyncedTime && (
                  <span className="att-profile-chip" style={{ opacity: 0.85 }}>
                    <Clock size={13} /> Synced at {lastSyncedTime}
                  </span>
                )}
                <span className="att-profile-chip status">
                  <ShieldCheck size={13} /> DSU Portal Verified
                </span>
              </div>
              <button className="att-disconnect-btn" onClick={handleDisconnectProfile}>
                Disconnect
              </button>
            </div>
          )}

          {/* Profile Form */}
          {showProfileForm && (
            <form onSubmit={handleSyncErp} className="att-profile-form">
              <div className="att-form-row">
                <label className="field">
                  <span>Student USN / SRN *</span>
                  <input
                    placeholder="e.g. 26UGENG2182"
                    value={profileInput.usn}
                    onChange={(e) => setProfileInput({ ...profileInput, usn: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>DSU ERP Password *</span>
                  <input
                    type="password"
                    placeholder="Enter DSU portal password"
                    value={profileInput.password}
                    onChange={(e) => setProfileInput({ ...profileInput, password: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="att-profile-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSyncing}
                  style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}
                >
                  <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Connecting to DSU ERP..." : "Sync Live Attendance"}
                </button>

                <div className="att-security-note">
                  <ShieldCheck size={16} />
                  <span>
                    <strong>Student Privacy Guarantee:</strong> Your credentials are sent securely
                    over SSL only to Dayananda Sagar University GNUMS server for verification and are
                    cached strictly inside your browser's private local storage.
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
              <p className="att-metric-sub">{overall.adviceText}</p>
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
            <span className="att-metric-label">Safe Bunking Buffer</span>
            <div className={`att-metric-num ${overall.canSkip > 0 ? "text-green" : "text-yellow"}`}>
              {overall.canSkip > 0 ? `${overall.canSkip} Classes` : "0 Classes"}
            </div>
            <p className="att-metric-sub">
              {overall.canSkip > 0
                ? "Can skip across subjects while staying above target"
                : `Must attend next ${overall.mustAttend} classes to reach ${targetPct}%`}
            </p>
          </div>
        </section>

        {/* Academic Calendar Projection Banner */}
        <section
          className="att-card"
          style={{
            marginBottom: "24px",
            padding: "18px 22px",
            background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "rgba(59, 130, 246, 0.12)",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Calendar size={22} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700 }}>
                  DSU Academic Calendar Outlook ({academicCalendar.semesters.ODD.name})
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #94a3b8)" }}>
                  Last working day: <strong>{academicCalendar.semesters.ODD.lastWorkingDay}</strong> • Semester End: <strong>{academicCalendar.semesters.ODD.endDate}</strong> • Standard: 75% (65% condonation)
                </p>
                {timetable && (
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted, #94a3b8)", opacity: 0.9 }}>
                    Your Schedule: <strong>{timetable.totalWeeklyClasses} classes/week</strong> • Approx <strong>{timetable.approxRemainingClasses} remaining classes</strong> till {timetable.lastWorkingDay}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              {timetable && timetable.scheduleByDay && (
                <button
                  type="button"
                  className="outline-button"
                  style={{
                    fontSize: "12px",
                    padding: "6px 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    borderRadius: "8px",
                  }}
                  onClick={() => setShowTimetable(!showTimetable)}
                >
                  <Calendar size={14} />
                  {showTimetable ? "Hide Weekly Timetable" : "View Weekly Timetable"}
                </button>
              )}
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  backgroundColor: overall.calendarProjection.isCooked
                    ? "var(--att-red-bg)"
                    : "var(--att-green-bg)",
                  color: overall.calendarProjection.isCooked
                    ? "var(--att-red)"
                    : "var(--att-green)",
                  border: `1px solid ${
                    overall.calendarProjection.isCooked
                      ? "var(--att-red-border)"
                      : "var(--att-green-border)"
                  }`,
                }}
              >
                {overall.calendarProjection.isCooked
                  ? "⚠️ Attention Required"
                  : "✓ On Track for Semester End"}
              </span>
            </div>
          </div>

          {/* Collapsible Weekly Timetable View */}
          {showTimetable && timetable?.scheduleByDay && (
            <div
              style={{
                marginTop: "18px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <h5 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--foreground, #f8fafc)" }}>
                  Personalized Weekly Class Schedule ({timetable.totalWeeklyClasses} classes/week)
                </h5>
                <span style={{ fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                  Synced from DSU ERP TimeTable Portal
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                {Object.entries(timetable.scheduleByDay)
                  .filter(([_, slots]) => slots && slots.length > 0)
                  .map(([day, slots]) => (
                    <div
                      key={day}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "10px",
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "13px",
                          color: "#60a5fa",
                          marginBottom: "8px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          paddingBottom: "4px",
                        }}
                      >
                        {day} ({slots.length} {slots.length === 1 ? "class" : "classes"})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {slots.map((slot, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: "12px",
                              lineHeight: "1.4",
                              background: "rgba(0,0,0,0.2)",
                              padding: "6px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "#f1f5f9" }}>
                              {slot.code}: {slot.title || "Class"}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", color: "var(--muted, #94a3b8)", fontSize: "11px" }}>
                              <span>{slot.time}</span>
                              <span style={{ color: slot.slotType === "Practical" ? "#c084fc" : "#93c5fd" }}>{slot.slotType}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* View Switcher Tabs */}
        <div className="att-tabs-bar">
          <button
            className={`att-tab-btn ${activeTab === "tracker" ? "active" : ""}`}
            onClick={() => setActiveTab("tracker")}
          >
            <BookOpen size={16} /> Enrolled Subjects ({subjects.length})
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
                <h2>Your Course Breakdown</h2>
                <span>
                  Tap <strong>(+1 Attended)</strong> or <strong>(+1 Missed)</strong> to test what-if scenarios live
                </span>
              </div>
              <div className="att-toolbar-right">
                <button
                  className="primary-button att-add-btn"
                  onClick={() => {
                    setEditingSubjectId(null);
                    setSubjectForm({ name: "", code: "", slotType: "Theory", attended: "", total: "" });
                    setShowAddSubject(true);
                  }}
                >
                  <Plus size={16} /> Add Custom Subject
                </button>
              </div>
            </div>

            {/* Modal / Dialog for Add / Edit Subject */}
            {showAddSubject && (
              <div className="att-modal-overlay">
                <div className="att-modal-card">
                  <div className="att-modal-header">
                    <h3>{editingSubjectId ? "Edit Subject" : "Add Subject"}</h3>
                    <button
                      className="att-close-btn"
                      onClick={() => setShowAddSubject(false)}
                    >
                      &times;
                    </button>
                  </div>
                  <form onSubmit={handleSaveSubject} className="att-modal-form">
                    <label className="field">
                      <span>Subject Title *</span>
                      <input
                        placeholder="e.g. Operating Systems"
                        value={subjectForm.name}
                        onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                        required
                        autoFocus
                      />
                    </label>
                    <div className="att-form-row">
                      <label className="field">
                        <span>Subject Code</span>
                        <input
                          placeholder="e.g. 26EN1101"
                          value={subjectForm.code}
                          onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Slot Type</span>
                        <select
                          value={subjectForm.slotType}
                          onChange={(e) => setSubjectForm({ ...subjectForm, slotType: e.target.value })}
                        >
                          <option value="Theory">Theory</option>
                          <option value="Practical">Practical</option>
                        </select>
                      </label>
                    </div>
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
                const tot = Number(sub.total ?? sub.conducted) || 0;
                const advice = calculateStaticAdvice(att, tot, targetPct);
                const colors = getStatusColor(advice.pct, targetPct);
                const subHistory = history[sub.id] || [];

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
                          {sub.slotType && (
                            <span
                              className="att-code-pill"
                              style={{
                                background: sub.slotType.toLowerCase() === "practical" ? "rgba(168, 85, 247, 0.15)" : "rgba(59, 130, 246, 0.15)",
                                color: sub.slotType.toLowerCase() === "practical" ? "#a855f7" : "#3b82f6",
                                border: "none",
                              }}
                            >
                              {sub.slotType}
                            </span>
                          )}
                          {sub.code && timetable?.weeklyHoursByCourse?.[sub.code] ? (
                            <span
                              className="att-code-pill"
                              style={{
                                background: "rgba(34, 197, 94, 0.12)",
                                color: "#4ade80",
                                border: "none",
                              }}
                              title="Scheduled classes per week in DSU ERP timetable"
                            >
                              {timetable.weeklyHoursByCourse[sub.code]} {timetable.weeklyHoursByCourse[sub.code] === 1 ? "class/wk" : "classes/wk"} (~{Math.round(timetable.weeklyHoursByCourse[sub.code] * 5.1)} left)
                            </span>
                          ) : null}
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
                      <span>{advice.adviceText}</span>
                    </div>

                    {/* Interactive +1 / -1 Action Buttons */}
                    <div className="att-quick-actions">
                      <button
                        className="att-btn-plus present"
                        onClick={() => adjustClass(sub.id, 1, 1)}
                        title="Simulate attending next class (+1 attended, +1 total)"
                      >
                        +1 Attended
                      </button>
                      <button
                        className="att-btn-plus absent"
                        onClick={() => adjustClass(sub.id, 0, 1)}
                        title="Simulate missing next class (+0 attended, +1 total)"
                      >
                        +1 Missed
                      </button>
                      <button
                        className="att-btn-undo"
                        onClick={() => undoAdjustClass(sub.id)}
                        title="Undo last simulation"
                        disabled={subHistory.length === 0}
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
                <h3>No subjects registered</h3>
                <p>Sync with DSU ERP or add your subjects to calculate your safe bunking limits.</p>
                <button
                  className="primary-button"
                  onClick={() => setShowProfileForm(true)}
                >
                  <RefreshCw size={15} /> Connect to DSU ERP
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
                <h2>Quick Attendance Simulator</h2>
                <p>
                  Test any attendance scenario without modifying your enrolled courses.
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
                    {quickAdvice.pct >= targetPct ? "Status: Eligible" : "Status: Below Target"}
                  </h4>
                  <p style={{ color: getStatusColor(quickAdvice.pct, targetPct).text }}>
                    {quickAdvice.adviceText}
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
                        const newPct = calculatePercentage(newAtt, newTot);
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
                        const newPct = calculatePercentage(newAtt, newTot);
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
