import { useState, useEffect, useRef } from "react";
import storage from "./storage";

const STORAGE_KEY = "defense-poll-grid-v1";

// Get user's timezone
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Get timezone abbreviation
const getTimezoneAbbr = () => {
  const date = new Date('2026-04-01'); // April date for DST
  const timeStr = date.toLocaleTimeString('en-US', { 
    timeZoneName: 'short',
    timeZone: getUserTimezone()
  });
  return timeStr.split(' ').pop(); // Get the timezone part (e.g., "EDT", "PDT")
};

// Convert time slot to user's local time
const convertToLocalTime = (date, timeStr) => {
  const [time, period] = timeStr.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  let hour24 = hours;
  
  if (period === 'PM' && hours !== 12) hour24 += 12;
  if (period === 'AM' && hours === 12) hour24 = 0;
  
  // Create date in ET (Eastern Time)
  const etDate = new Date(date);
  etDate.setHours(hour24, minutes, 0, 0);
  
  // Format for user's local timezone
  return etDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: getUserTimezone()
  });
};

// Format time for display (keeping original if in ET)
const formatTimeForDisplay = (timeStr) => {
  const userTz = getUserTimezone();
  const isET = userTz === 'America/New_York' || userTz === 'America/Toronto';
  
  if (isET) return timeStr;
  
  // Convert from ET to user's timezone
  const testDate = new Date('2026-04-01'); // Using a date in April
  return convertToLocalTime(testDate, timeStr);
};

const DAYS = [];
const start = new Date(2026, 3, 1);
const end = new Date(2026, 3, 23);
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const day = d.getDay();
  if (day !== 0 && day !== 6) {
    DAYS.push({
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      key: d.toISOString().slice(0, 10),
    });
  }
}

const TIMES = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM", "6:00 PM",
];

const SLOT_ID = (dayKey, time) => `${dayKey}|${time}`;

// Group days by week for display
const WEEKS = [];
let week = [];
DAYS.forEach((d, i) => {
  week.push(d);
  if (week.length === 5 || i === DAYS.length - 1) {
    WEEKS.push(week);
    week = [];
  }
});

export default function DefensePollGrid() {
  const [view, setView] = useState("form");
  const [name, setName] = useState("");
  const [mode, setMode] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [responses, setResponses] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [userTimezone, setUserTimezone] = useState("");
  const [timezoneAbbr, setTimezoneAbbr] = useState("");
  const [displayTimes, setDisplayTimes] = useState(TIMES);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [setupError, setSetupError] = useState("");
  const isDragging = useRef(false);
  const dragMode = useRef(null); // "add" or "remove"
  
  // Set timezone and display times on mount
  useEffect(() => {
    const tz = getUserTimezone();
    const abbr = getTimezoneAbbr();
    setUserTimezone(tz);
    setTimezoneAbbr(abbr);
    
    // Convert times if not in ET
    const isET = tz === 'America/New_York' || tz === 'America/Toronto';
    if (!isET) {
      setDisplayTimes(TIMES.map(time => formatTimeForDisplay(time)));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const result = await storage.get(STORAGE_KEY);
        if (result) setResponses(JSON.parse(result.value));
        setSetupError(""); // Clear any previous errors
      } catch (error) {
        console.error('Failed to load responses:', error);
        
        // Check if this is a setup error
        if (error.message && error.message.includes('Database not configured')) {
          setSetupError("Database not configured. Please set up Upstash Redis integration to enable shared responses.");
        } else {
          setSetupError("Failed to connect to database. Please try refreshing the page.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute overlap counts per slot
  const slotCounts = {};
  responses.forEach(r => {
    (r.slots || []).forEach(s => {
      slotCounts[s] = (slotCounts[s] || 0) + 1;
    });
  });
  const maxCount = Math.max(...Object.values(slotCounts), 1);
  const totalResponses = responses.length;

  function toggleSlot(slotId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (dragMode.current === "add") next.add(slotId);
      else if (dragMode.current === "remove") next.delete(slotId);
      else {
        if (next.has(slotId)) next.delete(slotId);
        else next.add(slotId);
      }
      return next;
    });
  }

  function handleMouseDown(slotId) {
    // Always toggle on click, regardless of drag
    const isSelected = selected.has(slotId);
    dragMode.current = isSelected ? "remove" : "add";
    toggleSlot(slotId);
    // Only set dragging after a delay to differentiate click from drag
    setTimeout(() => {
      isDragging.current = true;
    }, 100);
  }

  function handleMouseEnter(slotId) {
    if (isDragging.current) toggleSlot(slotId);
  }

  useEffect(() => {
    const up = () => { isDragging.current = false; dragMode.current = null; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  async function saveResponse() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (selected.size === 0) { setError("Please select at least one available slot."); return; }
    if (!mode) { setError("Please select a mode preference."); return; }

    const newResponse = {
      name: name.trim(),
      slots: Array.from(selected),
      mode,
    };
    
    try {
      const updated = await storage.addResponse(newResponse);
      setResponses(updated);
      setSubmitted(true);
      setError("");
    } catch (error) {
      console.error('Failed to save response:', error);
      setError("Something went wrong. Please try again.");
    }
  }

  // Admin functions
  function handleAdminLogin() {
    // Simple password check - you should change this password!
    if (adminPassword === "admin2026") {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPassword("");
    } else {
      alert("Incorrect password");
    }
  }

  async function resetAllSubmissions() {
    if (confirm("Are you sure you want to delete ALL submissions? This cannot be undone.")) {
      try {
        await storage.set(STORAGE_KEY, JSON.stringify([]));
        setResponses([]);
        alert("All submissions have been deleted.");
      } catch (error) {
        console.error('Failed to reset submissions:', error);
        alert("Failed to reset submissions.");
      }
    }
  }

  async function deleteResponse(responseId) {
    if (confirm("Are you sure you want to delete this response?")) {
      try {
        const updated = await storage.deleteResponse(responseId);
        setResponses(updated);
      } catch (error) {
        console.error('Failed to delete response:', error);
        alert("Failed to delete response.");
      }
    }
  }

  function exportData() {
    const dataStr = JSON.stringify(responses, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `defense-poll-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (Array.isArray(imported)) {
            await storage.set(STORAGE_KEY, JSON.stringify(imported));
            setResponses(imported);
            alert(`Imported ${imported.length} responses successfully.`);
          } else {
            alert("Invalid data format.");
          }
        } catch (error) {
          console.error('Import error:', error);
          alert("Failed to import data. Please check the file format.");
        }
      };
      reader.readAsText(file);
    }
  }

  function getColor(count) {
    if (count === 0) return "#f0ede6";
    const intensity = count / maxCount;
    if (intensity < 0.33) return "#b5d4a0";
    if (intensity < 0.66) return "#6aac4e";
    return "#2d5016";
  }

  function getTextColor(count) {
    if (count === 0) return "#bbb";
    const intensity = count / maxCount;
    return intensity > 0.5 ? "#fff" : "#1a1a1a";
  }

  const displayedDays = WEEKS[currentWeek] || [];

  const base = {
    minHeight: "100vh",
    background: "#f5f2ec",
    fontFamily: "'Georgia', serif",
    display: "flex",
    justifyContent: "center",
    padding: "36px 16px",
    userSelect: "none",
  };

  const card = {
    background: "#fff",
    border: "1px solid #ddd8ce",
    borderRadius: "8px",
    padding: "36px",
    maxWidth: "860px",
    width: "100%",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  };

  const mono = { fontFamily: "'DM Mono', monospace" };
  const label = { ...mono, fontSize: "11px", letterSpacing: "0.1em", color: "#2d5016", textTransform: "uppercase", display: "block", marginBottom: "10px" };

  function Grid({ interactive }) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: "72px" }} />
              {displayedDays.map(d => (
                <th key={d.key} style={{
                  ...mono,
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#444",
                  textAlign: "center",
                  padding: "0 0 12px 0",
                  letterSpacing: "0.03em",
                  lineHeight: "1.4",
                }}>
                  {d.label.split(", ").map((part, i) => <div key={i}>{part}</div>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayTimes.map((displayTime, ti) => (
              <tr key={TIMES[ti]}>
                <td style={{
                  ...mono,
                  fontSize: "11px",
                  color: "#888",
                  textAlign: "right",
                  paddingRight: "10px",
                  paddingTop: "1px",
                  paddingBottom: "1px",
                  whiteSpace: "nowrap",
                  verticalAlign: "middle",
                }}>
                  {displayTime.includes(":00") ? displayTime : ""}
                </td>
                {displayedDays.map(d => {
                  const slotId = SLOT_ID(d.key, TIMES[ti]);
                  const isSelected = interactive ? selected.has(slotId) : false;
                  const count = slotCounts[slotId] || 0;
                  const bg = interactive
                    ? isSelected ? "#2d5016" : "#f0ede6"
                    : getColor(count);

                  return (
                    <td
                      key={slotId}
                      onMouseDown={interactive ? () => handleMouseDown(slotId) : undefined}
                      onMouseEnter={interactive ? () => handleMouseEnter(slotId) : () => setHoveredSlot(slotId)}
                      onMouseLeave={interactive ? undefined : () => setHoveredSlot(null)}
                      style={{
                        background: bg,
                        border: "1px solid #e8e4dc",
                        height: "22px",
                        cursor: interactive ? "pointer" : "default",
                        transition: "background 0.1s",
                        position: "relative",
                      }}
                    >
                      {!interactive && count > 0 && hoveredSlot === slotId && (
                        <div style={{
                          position: "absolute",
                          bottom: "110%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#1a1a1a",
                          color: "#fff",
                          ...mono,
                          fontSize: "11px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          whiteSpace: "nowrap",
                          zIndex: 10,
                          pointerEvents: "none",
                        }}>
                          {count} / {totalResponses} available
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function WeekNav() {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <button
          onClick={() => setCurrentWeek(w => Math.max(0, w - 1))}
          disabled={currentWeek === 0}
          style={{
            ...mono, fontSize: "13px", background: "none",
            border: "1px solid #ccc", borderRadius: "4px",
            padding: "4px 10px", cursor: currentWeek === 0 ? "default" : "pointer",
            color: currentWeek === 0 ? "#ccc" : "#444",
          }}
        >
          &larr;
        </button>
        <span style={{ ...mono, fontSize: "12px", color: "#666" }}>
          Week {currentWeek + 1} of {WEEKS.length}
        </span>
        <button
          onClick={() => setCurrentWeek(w => Math.min(WEEKS.length - 1, w + 1))}
          disabled={currentWeek === WEEKS.length - 1}
          style={{
            ...mono, fontSize: "13px", background: "none",
            border: "1px solid #ccc", borderRadius: "4px",
            padding: "4px 10px", cursor: currentWeek === WEEKS.length - 1 ? "default" : "pointer",
            color: currentWeek === WEEKS.length - 1 ? "#ccc" : "#444",
          }}
        >
          &rarr;
        </button>
        <span style={{ ...mono, fontSize: "11px", color: "#aaa", marginLeft: "4px" }}>
          Click and drag to select slots
        </span>
      </div>
    );
  }

  if (loading) return <div style={{ ...base, alignItems: "center" }}><p style={{ ...mono, color: "#888" }}>Loading...</p></div>;

  return (
    <div style={base}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      
      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "#fff", padding: "32px", borderRadius: "8px",
            width: "320px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}>
            <h3 style={{ ...mono, fontSize: "14px", marginBottom: "20px" }}>Admin Login</h3>
            <input
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Enter password"
              style={{
                ...mono, fontSize: "13px", padding: "9px 14px",
                width: "100%", border: "1.5px solid #d4d0c8",
                borderRadius: "4px", marginBottom: "16px",
                boxSizing: "border-box",
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleAdminLogin}
                style={{
                  ...mono, fontSize: "12px", background: "#2d5016",
                  color: "#fff", border: "none", borderRadius: "4px",
                  padding: "8px 16px", cursor: "pointer", flex: 1,
                }}
              >
                Login
              </button>
              <button
                onClick={() => { setShowAdminLogin(false); setAdminPassword(""); }}
                style={{
                  ...mono, fontSize: "12px", background: "#f0ede6",
                  color: "#666", border: "none", borderRadius: "4px",
                  padding: "8px 16px", cursor: "pointer", flex: 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
          <div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "21px", fontWeight: "normal", color: "#1a1a1a", margin: 0 }}>
              Dissertation Defense Scheduling
            </h1>
            <p style={{ ...mono, fontSize: "12px", color: "#888", marginTop: "4px" }}>
              April 1 – April 23, 2026 {timezoneAbbr && `• Times shown in ${timezoneAbbr}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setView(view === "form" ? "results" : "form")}
              style={{
                ...mono, fontSize: "11px", background: "none",
                border: "1px solid #ccc", borderRadius: "4px",
                padding: "5px 10px", cursor: "pointer", color: "#666", whiteSpace: "nowrap",
              }}
            >
              {view === "form" ? `View Results (${totalResponses})` : "Back to Form"}
            </button>
            {!isAdmin && (
              <button
                onClick={() => setShowAdminLogin(true)}
                style={{
                  ...mono, fontSize: "11px", background: "none",
                  border: "1px solid #ccc", borderRadius: "4px",
                  padding: "5px 10px", cursor: "pointer", color: "#666",
                }}
              >
                Admin
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setIsAdmin(false)}
                style={{
                  ...mono, fontSize: "11px", background: "#2d5016",
                  border: "1px solid #2d5016", borderRadius: "4px",
                  padding: "5px 10px", cursor: "pointer", color: "#fff",
                }}
              >
                Exit Admin
              </button>
            )}
          </div>
        </div>

        {/* Setup Error Banner */}
        {setupError && (
          <div style={{
            background: "#fff3cd", border: "1px solid #ffeaa7",
            borderRadius: "6px", padding: "16px", marginBottom: "20px",
            borderLeft: "4px solid #fdcb6e",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ fontSize: "18px", marginTop: "2px" }}>⚠️</div>
              <div>
                <div style={{ ...mono, fontSize: "13px", fontWeight: "600", color: "#8b6914", marginBottom: "4px" }}>
                  Database Setup Required
                </div>
                <div style={{ fontSize: "14px", color: "#8b6914", marginBottom: "8px" }}>
                  {setupError}
                </div>
                <div style={{ ...mono, fontSize: "12px", color: "#a0770a" }}>
                  Go to Vercel Marketplace → Search "Upstash Redis" → Add Integration
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "results" ? (
          <div style={{ marginTop: "24px" }}>
            <p style={{ ...mono, fontSize: "13px", color: "#555", marginBottom: "20px" }}>
              {totalResponses} {totalResponses === 1 ? "response" : "responses"} — darker green means more overlap
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <span style={{ ...mono, fontSize: "11px", color: "#888" }}>0</span>
              {[0.1, 0.3, 0.6, 1.0].map(v => (
                <div key={v} style={{ width: "24px", height: "14px", background: getColor(v * maxCount), borderRadius: "2px" }} />
              ))}
              <span style={{ ...mono, fontSize: "11px", color: "#888" }}>{maxCount}</span>
              <span style={{ ...mono, fontSize: "11px", color: "#888", marginLeft: "4px" }}>available</span>
            </div>

            <WeekNav />
            <Grid interactive={false} />

            {responses.length > 0 && (
              <div style={{ marginTop: "28px" }}>
                <span style={label}>Mode Preferences</span>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                  {["In-Person", "Virtual", "No Preference"].map(m => {
                    const count = responses.filter(r => r.mode === m).length;
                    return (
                      <div key={m} style={{ ...mono, fontSize: "13px", color: "#444" }}>
                        {m}: <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {responses.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <span style={label}>Respondents</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {responses.map(r => (
                    <span key={r.id} style={{
                      ...mono, fontSize: "12px", color: "#555",
                      background: "#f0ede6", borderRadius: "4px",
                      padding: "4px 10px", position: "relative",
                      paddingRight: isAdmin ? "28px" : "10px",
                    }}>
                      {r.name} ({r.mode})
                      {isAdmin && (
                        <button
                          onClick={() => deleteResponse(r.id)}
                          style={{
                            position: "absolute", right: "4px", top: "50%",
                            transform: "translateY(-50%)", background: "none",
                            border: "none", color: "#c0392b", cursor: "pointer",
                            fontSize: "14px", padding: "0 4px",
                          }}
                          title="Delete response"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Admin Controls */}
            {isAdmin && (
              <div style={{
                marginTop: "32px", padding: "20px",
                background: "#faf9f6", borderRadius: "8px",
                border: "1px solid #e8e4dc",
              }}>
                <span style={{ ...label, marginBottom: "16px" }}>Admin Controls</span>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    onClick={exportData}
                    style={{
                      ...mono, fontSize: "12px", background: "#2d5016",
                      color: "#fff", border: "none", borderRadius: "4px",
                      padding: "8px 16px", cursor: "pointer",
                    }}
                  >
                    Export Data (JSON)
                  </button>
                  <label style={{
                    ...mono, fontSize: "12px", background: "#fff",
                    color: "#666", border: "1px solid #ccc", borderRadius: "4px",
                    padding: "8px 16px", cursor: "pointer",
                  }}>
                    Import Data
                    <input
                      type="file"
                      accept=".json"
                      onChange={importData}
                      style={{ display: "none" }}
                    />
                  </label>
                  <button
                    onClick={resetAllSubmissions}
                    style={{
                      ...mono, fontSize: "12px", background: "#c0392b",
                      color: "#fff", border: "none", borderRadius: "4px",
                      padding: "8px 16px", cursor: "pointer",
                    }}
                  >
                    Reset All Submissions
                  </button>
                </div>
                <p style={{ ...mono, fontSize: "11px", color: "#888", marginTop: "12px" }}>
                  Total responses: {responses.length} | 
                  Storage: localStorage (browser-based) |
                  Password: admin2026 (change in code)
                </p>
              </div>
            )}
          </div>
        ) : submitted ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>✓</div>
            <p style={{ ...mono, fontSize: "13px", color: "#2d5016", marginBottom: "8px" }}>Response recorded. Thank you.</p>
            <button
              onClick={() => { setSubmitted(false); setName(""); setSelected(new Set()); setMode(null); }}
              style={{ ...mono, fontSize: "12px", color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Submit another response
            </button>
          </div>
        ) : (
          <div style={{ marginTop: "24px" }}>
            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontFamily: "Georgia, serif", fontSize: "14px", color: "#555", marginBottom: "8px", lineHeight: "1.7" }}>
                Click or drag across the grid to mark all slots that work for you. Then indicate your mode preference below.
              </p>
              {timezoneAbbr && timezoneAbbr !== 'EDT' && timezoneAbbr !== 'EST' && (
                <p style={{ ...mono, fontSize: "11px", color: "#999", fontStyle: "italic" }}>
                  Note: All times are automatically converted from Eastern Time to your local timezone ({timezoneAbbr}).
                </p>
              )}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <span style={label}>Your Name</span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                style={{
                  ...mono, fontSize: "13px",
                  padding: "9px 14px", width: "280px",
                  border: "1.5px solid #d4d0c8", borderRadius: "4px",
                  background: "#faf9f6", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <span style={label}>Mode Preference</span>
              <div style={{ display: "flex", gap: "10px" }}>
                {["In-Person", "Virtual", "No Preference"].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      ...mono, fontSize: "12px",
                      padding: "6px 14px",
                      border: mode === m ? "2px solid #2d5016" : "2px solid #d4d0c8",
                      borderRadius: "4px",
                      background: mode === m ? "#2d5016" : "#faf9f6",
                      color: mode === m ? "#fff" : "#555",
                      cursor: "pointer",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <span style={label}>
                Available Slots
                {selected.size > 0 && <span style={{ color: "#888", marginLeft: "8px", textTransform: "none", letterSpacing: 0 }}>({selected.size} selected)</span>}
              </span>
              <WeekNav />
              <Grid interactive={true} />
            </div>

            {error && <p style={{ ...mono, fontSize: "12px", color: "#c0392b", marginBottom: "14px" }}>{error}</p>}

            <button
              onClick={saveResponse}
              style={{
                background: "#2d5016", color: "#fff",
                border: "none", borderRadius: "4px",
                padding: "11px 28px",
                ...mono, fontSize: "13px", fontWeight: "600",
                cursor: "pointer", letterSpacing: "0.05em",
              }}
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}