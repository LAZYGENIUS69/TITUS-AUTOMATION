import React, { useState, useEffect } from "react";
import {
  ArrowLeft, RefreshCw, FileText, Send, AlertCircle, ExternalLink,
} from "lucide-react";
import { authenticatedAssetUrl } from "../auth";

const STATUS_FILTERS = ["All", "Pending", "Failed"];

function MetricCard({ label, value, color = "text-text-primary" }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-widest text-text-muted font-sans">{label}</span>
      <span className={`font-mono text-2xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "border-warning text-warning",
    sent: "border-accent text-accent",
    generated: "border-accent text-accent",
    generating: "border-warning text-warning",
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

function LogCell({ error }) {
  const [expanded, setExpanded] = useState(false);
  if (!error) return <span className="text-text-muted">—</span>;
  return (
    <div className="flex flex-col gap-1 min-w-[220px] max-w-[620px]">
      <div
        onClick={() => setExpanded(!expanded)}
        className={`text-danger cursor-pointer font-mono text-[11px] p-2 rounded border border-danger/20 bg-danger/5 hover:bg-danger/10 transition-colors duration-100 ${
          expanded ? "whitespace-pre-wrap break-words block" : "truncate block max-w-[360px]"
        }`}
        title="Click to toggle full error log"
        style={{ userSelect: "text" }}
      >
        {error}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[9px] font-bold text-accent hover:underline self-start font-mono"
      >
        {expanded ? "Show Less ▲" : "Show More ▼"}
      </button>
    </div>
  );
}

export default function RunDetail({ runId, onNavigate, events, onStatusChange }) {
  const [runProgress, setRunProgress] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/runs/${runId}/status`);
      if (!response.ok) throw new Error("Failed to fetch run status");
      const data = await response.json();
      setRunProgress(data);
      onStatusChange?.(data.status);
      if (data.status === "generating" || data.status === "sending") {
        setIsPolling(true);
      } else {
        setIsPolling(false);
      }
    } catch (err) {
      setErrorMessage(err.message);
      setIsPolling(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [runId]);

  // Auto-start PDF generation when run is freshly created (pending + no PDFs yet)
  useEffect(() => {
    if (
      runProgress &&
      runProgress.status === "pending" &&
      runProgress.pdf_generated === 0 &&
      !isPolling
    ) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runProgress?.status]);

  useEffect(() => {
    let id;
    if (isPolling) {
      id = setInterval(fetchStatus, 2000);
    }
    return () => { if (id) clearInterval(id); };
  }, [isPolling]);

  const handleGenerate = async () => {
    setErrorMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/generate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to trigger generation");
      }
      setIsPolling(true);
      fetchStatus();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleSend = async () => {
    setErrorMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/send`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to trigger send");
      }
      setIsPolling(true);
      fetchStatus();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  if (!runProgress) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <RefreshCw size={24} className="animate-spin text-text-muted" />
        <span className="font-mono text-sm text-text-muted">Loading run details...</span>
      </div>
    );
  }

  const { total_rows, pdf_generated, email_sent, email_failed, status } = runProgress;

  // Progress bar
  let progressPct = 0;
  let progressLabel = "";
  if (status === "generating") {
    progressPct = total_rows > 0 ? (pdf_generated / total_rows) * 100 : 0;
    progressLabel = `Generating PDFs — ${pdf_generated} / ${total_rows}`;
  } else if (status === "sending") {
    const processed = email_sent + email_failed;
    progressPct = total_rows > 0 ? (processed / total_rows) * 100 : 0;
    progressLabel = `Sending emails — ${processed} / ${total_rows}`;
  } else if (["generated", "completed", "failed"].includes(status)) {
    progressPct = 100;
    progressLabel =
      status === "completed"
        ? "All emails processed"
        : status === "generated"
        ? "PDFs ready — trigger email send"
        : "Finished with failures";
  }

  const matchingEvent = events.find((e) => e.id === runProgress.event_id);
  const eventName = matchingEvent ? matchingEvent.name : `Event ID ${runProgress.event_id}`;

  // Filter rows
  const allRows = runProgress.rows ?? [];
  const filteredRows = allRows.filter((row) => {
    if (activeFilter === "Pending") return row.email_status === "pending";
    if (activeFilter === "Failed") return row.email_status === "failed";
    return true;
  });

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-1.5 text-text-muted hover:text-text-primary border border-border rounded transition-colors duration-150"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl text-text-primary tracking-tight">
                Run <span className="font-mono text-xl">#{runId}</span>
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {eventName}
              <span className="text-border mx-1.5">·</span>
              {runProgress.excel_filename}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            disabled={isPolling}
            className="p-1.5 text-text-muted hover:text-text-primary border border-border rounded transition-colors duration-150 disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={15} className={isPolling ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleGenerate}
            disabled={
              status === "generating" || status === "sending" || status === "completed"
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <FileText size={14} /> Generate PDFs
          </button>
          <button
            onClick={handleSend}
            disabled={
              status === "pending" ||
              status === "generating" ||
              status === "sending" ||
              pdf_generated === 0
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-bg bg-accent rounded hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={14} /> Send Emails
          </button>
        </div>
      </div>

      {/* Pending call-to-action banner */}
      {status === "pending" && !errorMessage && (
        <div className="flex items-center justify-between gap-3 bg-warning/10 border border-warning/30 rounded-lg p-3">
          <div className="flex items-center gap-2.5 text-warning">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span className="text-sm font-medium">Ready to generate — click "Generate PDFs" to start processing certificates.</span>
          </div>
          <button
            onClick={handleGenerate}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-bg bg-warning rounded hover:opacity-90 transition-opacity"
          >
            <FileText size={14} /> Generate PDFs
          </button>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="flex items-start gap-3 bg-surface border border-danger rounded-lg p-3 text-danger">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Generated" value={pdf_generated} color="text-accent" />
        <MetricCard label="Sent" value={email_sent} color="text-accent" />
        <MetricCard
          label="Failed"
          value={email_failed}
          color={email_failed > 0 ? "text-danger" : "text-text-muted"}
        />
      </div>

      {/* Progress bar */}
      {progressPct > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-mono">{progressLabel}</span>
            <span className="text-xs font-mono text-text-muted">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-alt rounded-full overflow-hidden border border-border">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Recipient table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {/* Filter tabs */}
        <div className="flex items-center border-b border-border px-4 gap-0">
          {STATUS_FILTERS.map((f) => {
            const count =
              f === "All"
                ? allRows.length
                : allRows.filter((r) => r.email_status === f.toLowerCase()).length;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={[
                  "px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors duration-150",
                  activeFilter === f
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text-primary",
                ].join(" ")}
              >
                {f}
                <span className="ml-1.5 font-mono text-[10px] text-text-muted">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                {["#", "Recipient", "Details", "PDF", "Email Status", "Log"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[11px] uppercase tracking-widest text-text-muted font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-text-muted font-mono"
                  >
                    No rows match the current filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  let rowData = {};
                  try { rowData = JSON.parse(row.row_data); } catch {}

                  let nameVal = "Unknown";
                  const nameKeys = ["full name", "name", "student name", "recipient name", "recipient", "username"];
                  for (const k of nameKeys) {
                    const match = Object.keys(rowData).find(
                      (rk) => rk.toLowerCase().trim() === k
                    );
                    if (match) { nameVal = rowData[match]; break; }
                  }

                  const otherDetails = Object.keys(rowData)
                    .filter(
                      (k) =>
                        k.toLowerCase().trim() !== "email" &&
                        !nameKeys.includes(k.toLowerCase().trim())
                    )
                    .map((k) => `${k}: ${rowData[k]}`)
                    .join(" · ");

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-alt transition-colors duration-100"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-text-primary">
                        {nameVal}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-text-muted max-w-xs overflow-hidden"
                        title={otherDetails}
                      >
                        <span className="block truncate">{otherDetails || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.pdf_path ? (
                          <a
                            href={authenticatedAssetUrl(`${API_BASE}/${row.pdf_path}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-accent text-xs font-mono hover:underline"
                          >
                            View <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-xs text-text-muted italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.email_status} />
                      </td>
                      <td className="px-4 py-3 text-xs font-mono max-w-md">
                        <LogCell error={row.email_error} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
