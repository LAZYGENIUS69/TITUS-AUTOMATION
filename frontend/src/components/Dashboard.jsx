import React from "react";
import {
  Plus, Play, Trash2, Calendar, ChevronRight,
  Award, Activity, Mail,
} from "lucide-react";

function MetricCard({ label, value, color = "text-text-primary" }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-2">
      <span className="text-xs uppercase tracking-widest text-text-muted font-sans">{label}</span>
      <span className={`font-mono text-3xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "border-warning text-warning",
    generating: "border-accent text-accent",
    generated: "border-accent text-accent",
    sending: "border-warning text-warning",
    completed: "border-accent text-accent",
    failed: "border-danger text-danger",
  };
  const cls = map[status] || "border-border text-text-muted";
  return (
    <span className={`font-mono text-[11px] border rounded px-1.5 py-0.5 ${cls}`}>
      {status}
    </span>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="px-4 py-2.5 border-b border-border bg-surface-alt">
      <span className="text-xs uppercase tracking-widest text-text-muted font-sans font-semibold">
        {children}
      </span>
    </div>
  );
}

export default function Dashboard({ events, runs, onNavigate, onDeleteEvent }) {
  // Compute metrics
  const totalEvents = events.length;
  const totalGenerated = runs.reduce((acc, r) => acc + (r.pdf_generated ?? 0), 0);
  const totalSent = runs.reduce((acc, r) => acc + (r.email_sent ?? 0), 0);

  // Show most recent 6
  const recentEvents = [...events].reverse().slice(0, 6);
  const recentRuns = [...runs].reverse().slice(0, 6);

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Page heading + actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-text-primary tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Overview of events, generated certificates, and email runs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate("event-setup")}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-muted bg-surface border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150"
          >
            <Plus size={14} />
            New Event
          </button>
          <button
            onClick={() => onNavigate("run-setup")}
            disabled={events.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-bg bg-accent rounded hover:opacity-90 transition-opacity duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            Start Run
          </button>
        </div>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Total Events" value={totalEvents} />
        <MetricCard label="Certs Generated" value={totalGenerated} color="text-accent" />
        <MetricCard label="Certs Sent" value={totalSent} color="text-accent" />
      </div>

      {/* Two-column lists */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent Events */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <SectionHeader>
            <span className="flex items-center gap-2">
              <Award size={12} />
              Recent Events
            </span>
          </SectionHeader>

          {recentEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No event templates yet.{" "}
              <button
                onClick={() => onNavigate("event-setup")}
                className="text-accent underline underline-offset-2 hover:no-underline"
              >
                Create one
              </button>
            </div>
          ) : (
            <div>
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-alt transition-colors duration-100"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {event.name}
                      </span>
                      {event.template_missing && (
                        <span className="text-[10px] bg-danger/10 text-danger border border-danger/20 rounded px-1.5 py-0.5 font-sans font-medium flex items-center gap-1">
                          ⚠️ Template Missing
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                      <Calendar size={11} />
                      {new Date(event.created_at).toLocaleDateString()}
                      <span className="text-border">·</span>
                      <span className="font-mono">{event.fields?.length ?? 0}</span> fields
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <button
                      onClick={() => onNavigate("event-setup", { eventId: event.id })}
                      className="px-2 py-1 text-xs text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteEvent(event.id)}
                      className="p-1 text-text-muted hover:text-danger transition-colors duration-150"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Runs */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <SectionHeader>
            <span className="flex items-center gap-2">
              <Activity size={12} />
              Recent Runs
            </span>
          </SectionHeader>

          {recentRuns.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No certificate runs yet.
            </div>
          ) : (
            <div>
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  onClick={() => onNavigate("run-detail", { runId: run.id })}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-alt transition-colors duration-100 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-text-primary">
                        Run #{run.id}
                      </span>
                      <StatusBadge status={run.status} />
                    </div>
                    <span className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                      <Mail size={11} />
                      {run.event_name}
                      <span className="text-border">·</span>
                      <Calendar size={11} />
                      {new Date(run.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-text-muted flex-shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
