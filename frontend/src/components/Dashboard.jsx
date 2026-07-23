import React from "react";
import {
  Plus, Play, Trash2, Calendar, ChevronRight,
  Award, Activity, Mail, CalendarDays, FileCheck2, Send,
} from "lucide-react";

function MetricCard({ label, value, color = "text-text-primary", icon: Icon, detail }) {
  return (
    <div className="group relative overflow-hidden bg-surface border border-border rounded-lg px-4 py-3.5 flex flex-col gap-2 min-h-[104px] shadow-[0_8px_24px_rgb(0_0_0/0.08)] transition-colors duration-150 hover:border-accent/40">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-text-muted font-sans font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
            <Icon size={15} strokeWidth={1.8} />
          </span>
          {label}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-accent opacity-70 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex items-end justify-between gap-3 pl-9">
        <span className={`font-mono text-[2rem] leading-none font-semibold tracking-tight ${color}`}>{value}</span>
        <span className="text-[11px] text-text-muted font-medium">{detail}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "bg-warning/10 border-warning/30 text-warning",
    generating: "bg-accent/10 border-accent/30 text-accent",
    generated: "bg-accent/10 border-accent/30 text-accent",
    sending: "bg-warning/10 border-warning/30 text-warning",
    completed: "bg-accent/10 border-accent/30 text-accent",
    failed: "bg-danger/10 border-danger/30 text-danger",
  };
  const cls = map[status] || "border-border text-text-muted";
  return (
    <span className={`font-mono text-[11px] font-medium border rounded-full px-2 py-0.5 ${cls}`}>
      {status}
    </span>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="px-4 py-2.5 border-b border-border bg-surface-alt/45">
      <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-sans font-semibold">
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
    <div className="flex flex-col gap-5 max-w-6xl">
      {/* Page heading + actions */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent font-semibold mb-1">
            <Activity size={13} />
            Workspace overview
          </div>
          <h1 className="font-heading text-3xl text-text-primary tracking-tight leading-none">
            Dashboard
          </h1>
          <p className="text-sm text-text-muted mt-2 font-medium">
            Overview of templates, certificate output, and delivery activity.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onNavigate("event-setup")}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-text-primary bg-surface-alt border border-border rounded-md shadow-[0_4px_12px_rgb(0_0_0/0.06)] hover:bg-surface hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 transition-colors duration-150"
          >
            <Plus size={14} />
            New Event
          </button>
          <button
            onClick={() => onNavigate("run-setup")}
            disabled={events.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-bg bg-accent rounded-md shadow-[0_6px_16px_rgb(var(--color-accent)/0.22)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 transition duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            Start Run
          </button>
        </div>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-3 gap-3.5">
        <MetricCard label="Total Events" value={totalEvents} icon={CalendarDays} detail="templates" />
        <MetricCard label="Certs Generated" value={totalGenerated} color="text-accent" icon={FileCheck2} detail="this workspace" />
        <MetricCard label="Certs Sent" value={totalSent} color="text-accent" icon={Send} detail="delivered" />
      </div>

      {/* Two-column lists */}
      <div className="grid grid-cols-2 gap-3.5 items-start">
        {/* Recent Events */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden self-start w-full shadow-[0_8px_24px_rgb(0_0_0/0.06)]">
          <SectionHeader>
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
              <Award size={12} />
              Recent Events
              </span>
              <span className="font-mono text-[10px] tracking-normal text-text-muted">{recentEvents.length} shown</span>
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
                  className="group flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-alt/70 transition-colors duration-100"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {event.name}
                      </span>
                      {event.template_missing && (
                        <span className="text-[10px] bg-danger/10 text-danger border border-danger/20 rounded px-1.5 py-0.5 font-sans font-medium flex items-center gap-1">
                          ⚠️ Template Missing
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted mt-1 flex items-center gap-1.5 font-medium">
                      <Calendar size={11} />
                      {new Date(event.created_at).toLocaleDateString()}
                      <span className="text-border">·</span>
                      <span className="font-mono">{event.fields?.length ?? 0}</span> fields
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <button
                      onClick={() => onNavigate("event-setup", { eventId: event.id })}
                      className="px-2 py-1 text-xs font-medium text-text-muted border border-border rounded-md hover:text-text-primary hover:border-text-muted transition-colors duration-150"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteEvent(event.id)}
                      className="p-1 text-text-muted hover:text-danger transition-colors duration-150"
                      title="Delete"
                      aria-label={`Delete ${event.name}`}
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
        <div className="bg-surface border border-accent/20 rounded-lg overflow-hidden self-start w-full shadow-[0_10px_28px_rgb(0_0_0/0.1)]">
          <SectionHeader>
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
              <Activity size={12} />
              Recent Runs
              </span>
              <span className="font-mono text-[10px] tracking-normal text-text-muted">{recentRuns.length} shown</span>
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
                  className="group flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-alt/70 transition-colors duration-100 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-text-primary">
                        Run #{run.id}
                      </span>
                      <StatusBadge status={run.status} />
                    </div>
                    <span className="text-xs text-text-muted mt-1 flex items-center gap-1.5 font-medium">
                      <Mail size={11} />
                      {run.event_name}
                      <span className="text-border">·</span>
                      <Calendar size={11} />
                      {new Date(run.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-text-muted flex-shrink-0 ml-2 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
