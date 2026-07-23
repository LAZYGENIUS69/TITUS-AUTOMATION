import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import EventSetup from "./components/EventSetup";
import RunSetup from "./components/RunSetup";
import RunDetail from "./components/RunDetail";
import WelcomePage from "./components/WelcomePage";
import { API_BASE, clearAuthSession, getAuthToken } from "./auth";
import { LayoutDashboard, CalendarDays, PlayCircle, Sun, Moon, LogOut } from "lucide-react";
import titusLogo from "./assets/titus-logo.png";
import "./App.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "event-setup", label: "Events", icon: CalendarDays },
  { id: "run-setup", label: "Runs", icon: PlayCircle },
];

function StatusPill({ view, runStatus }) {
  if (view === "run-detail" && runStatus) {
    const colorMap = {
      pending: "bg-warning/10 border-warning text-warning",
      generating: "bg-accent-soft border-accent text-accent",
      generated: "bg-accent-soft border-accent text-accent",
      sending: "bg-warning/10 border-warning text-warning",
      completed: "bg-accent-soft border-accent text-accent",
      failed: "bg-danger/10 border-danger text-danger",
    };
    const cls = colorMap[runStatus] || "border-border text-text-muted";
    return (
      <span className={`font-mono text-xs border rounded px-2 py-0.5 ${cls}`}>
        {runStatus}
      </span>
    );
  }
  const labels = {
    dashboard: "Overview",
    "event-setup": "Event Setup",
    "run-setup": "New Run",
    "run-detail": "Run Detail",
  };
  return (
    <span className="font-mono text-xs text-text-muted border border-border rounded px-2 py-0.5 bg-surface">
      {labels[view] || view}
    </span>
  );
}

function App() {
  const [view, setView] = useState("dashboard");
  const [viewParams, setViewParams] = useState({});
  const [events, setEvents] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runStatus, setRunStatus] = useState(null);
  // Dark is the product default; an explicit light-mode choice remains persisted.
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("titus-theme") !== "light");
  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const fetchInitialData = async () => {
    try {
      const eventsRes = await fetch(`${API_BASE}/api/events`);
      if (!eventsRes.ok) throw new Error("Could not load events");
      const eventsData = await eventsRes.json();
      setEvents(eventsData);

      const runsRes = await fetch(`${API_BASE}/api/runs`);
      if (!runsRes.ok) throw new Error("Could not load runs");
      const runsData = await runsRes.json();

      const runsWithEventNames = runsData.map((run) => {
        const matchingEvent = eventsData.find((e) => e.id === run.event_id);
        return {
          ...run,
          event_name: matchingEvent ? matchingEvent.name : `Event ID ${run.event_id}`,
        };
      });
      setRuns(runsWithEventNames);
    } catch (err) {
      console.error("API error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    fetch(`${API_BASE}/api/auth/me`)
      .then((response) => {
        if (!response.ok) throw new Error("Session expired");
        return response.json();
      })
      .then(setAuthUser)
      .catch(() => clearAuthSession())
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    if (authUser) fetchInitialData();
    else setLoading(false);
  }, [authUser]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("titus-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleNavigate = (newView, params = {}) => {
    setView(newView);
    setViewParams(params);
    setRunStatus(null);
  };

  const handleRefreshEvents = () => fetchInitialData();

  const handleLogout = () => {
    clearAuthSession();
    setAuthUser(null);
    setEvents([]);
    setRuns([]);
    setView("dashboard");
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Delete this event template? This will also delete all associated runs and generated PDFs.")) return;
    try {
      const response = await fetch(`${API_BASE}/api/events/${eventId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete event");
      fetchInitialData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateRun = (runId) => {
    fetchInitialData().then(() => handleNavigate("run-detail", { runId }));
  };

  // Determine active nav item (sidebar highlight)
  const activeNav =
    view === "run-detail" ? "run-setup" :
    view === "event-setup" ? "event-setup" :
    "dashboard";

  const renderView = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <span className="font-heading text-2xl text-text-primary tracking-tight">TITUS</span>
          <span className="font-mono text-sm text-text-muted">Connecting to backend services...</span>
        </div>
      );
    }
    switch (view) {
      case "dashboard":
        return (
          <Dashboard
            events={events}
            runs={runs}
            onNavigate={handleNavigate}
            onDeleteEvent={handleDeleteEvent}
          />
        );
      case "event-setup":
        return (
          <EventSetup
            eventId={viewParams.eventId}
            onNavigate={handleNavigate}
            onRefreshEvents={handleRefreshEvents}
          />
        );
      case "run-setup":
        return (
          <RunSetup
            events={events}
            onNavigate={handleNavigate}
            onCreateRun={handleCreateRun}
          />
        );
      case "run-detail":
        return (
          <RunDetail
            runId={viewParams.runId}
            onNavigate={handleNavigate}
            events={events}
            onStatusChange={setRunStatus}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full font-mono text-text-muted">
            Page not found
          </div>
        );
    }
  };

  if (authChecking) return <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted font-mono text-sm">Checking secure session...</div>;
  if (!authUser) return <WelcomePage darkMode={darkMode} onToggleTheme={() => setDarkMode((current) => !current)} onAuthenticated={setAuthUser} />;

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="h-14 flex-shrink-0 bg-surface border-b border-border flex items-center justify-between px-5">
        <button
          onClick={() => handleNavigate("dashboard")}
          className="flex items-center gap-2.5 group"
        >
          <img src={titusLogo} alt="TITUS logo" className="w-9 h-9 rounded-full object-cover" />
          <span className="font-heading font-semibold text-lg text-text-primary tracking-tight group-hover:text-accent transition-colors duration-150">
            TITUS
          </span>
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDarkMode((current) => !current)}
            className="min-h-10 min-w-10 p-1.5 text-text-muted hover:text-text-primary border border-border rounded transition-colors duration-150"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <span className="hidden md:block text-xs text-text-muted font-medium max-w-[180px] truncate" title={authUser.email}>{authUser.email}</span>
          <button type="button" onClick={handleLogout} className="min-h-10 min-w-10 p-1.5 text-text-muted hover:text-danger border border-border rounded transition-colors" title="Sign out" aria-label="Sign out">
            <LogOut size={15} />
          </button>
          <StatusPill view={view} runStatus={runStatus} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ─────────────────────────────────────── */}
        <aside className="w-60 flex-shrink-0 bg-surface-alt border-r border-border flex flex-col pt-4">
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeNav === id;
              const isDisabled = id === "run-setup" && events.length === 0;
              return (
                <button
                  key={id}
                  onClick={() => !isDisabled && handleNavigate(id)}
                  disabled={isDisabled}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors duration-150 text-left w-full",
                    isActive
                      ? "bg-accent-soft text-accent"
                      : isDisabled
                      ? "text-text-muted opacity-40 cursor-not-allowed"
                      : "text-text-muted hover:text-text-primary hover:bg-surface",
                  ].join(" ")}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="mt-auto px-4 pb-4 border-t border-border pt-4">
            <p className="font-mono text-[10px] text-text-muted leading-relaxed">
              Certificate Automation<br />
              <span className="text-border">v1.0.0</span>
            </p>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────── */}
        <main className="flex-1 overflow-auto bg-bg p-6 flex flex-col">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;
