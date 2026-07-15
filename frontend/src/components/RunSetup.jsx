import React, { useState, useCallback } from "react";
import {
  ArrowLeft, ArrowRight, Play, Upload, FileSpreadsheet,
  AlertCircle, HelpCircle, Check,
} from "lucide-react";

const STEPS = [
  { label: "Select Event" },
  { label: "Upload Excel" },
  { label: "Map Email Col" },
  { label: "Confirm" },
];

function Stepper({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-semibold border transition-colors duration-200",
                  done
                    ? "bg-accent border-accent text-bg"
                    : active
                    ? "border-accent text-accent bg-transparent"
                    : "border-border text-text-muted bg-transparent",
                ].join(" ")}
              >
                {done ? <Check size={13} /> : idx + 1}
              </div>
              <span
                className={[
                  "text-[11px] font-medium whitespace-nowrap",
                  active ? "text-text-primary" : done ? "text-accent" : "text-text-muted",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className="stepper-line mx-3 mb-5"
                style={{ background: done ? "rgb(var(--color-accent))" : "rgb(var(--color-border))" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function RunSetup({ events, onNavigate, onCreateRun }) {
  const [step, setStep] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [emailColumn, setEmailColumn] = useState("Email");
  const [excelFile, setExcelFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === "xlsx" || ext === "xls") {
        setExcelFile(file);
        setErrorMessage("");
      } else {
        setErrorMessage("Please upload a valid Excel spreadsheet (.xlsx or .xls).");
      }
    }
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const API_BASE = "http://localhost:8000";

  const selectedEvent = events.find((e) => e.id === parseInt(selectedEventId));

  const handleSubmit = async () => {
    if (!selectedEventId || !excelFile || !emailColumn) {
      setErrorMessage("Please complete all steps before submitting.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData();
    formData.append("event_id", selectedEventId);
    formData.append("email_column", emailColumn);
    formData.append("excel_file", excelFile);
    try {
      const response = await fetch(`${API_BASE}/api/runs`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to create run");
      }
      const runData = await response.json();
      onCreateRun(runData.id);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!selectedEventId && !selectedEvent?.template_missing;
    if (step === 1) return !!excelFile;
    if (step === 2) return emailColumn.trim().length > 0;
    return true;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full py-8">
      <div className="w-full max-w-lg">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate("dashboard")}
          className="p-1.5 text-text-muted hover:text-text-primary border border-border rounded transition-colors duration-150"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-heading text-2xl text-text-primary tracking-tight">
            Start Certificate Run
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Upload an Excel sheet to generate and send certificates in bulk.
          </p>
        </div>
      </div>

      <Stepper current={step} />

      {/* Error */}
      {errorMessage && (
        <div className="flex items-start gap-3 bg-surface border border-danger rounded-lg p-3 mb-4 text-danger">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Step panels */}
      <div className="bg-surface border border-border rounded-lg p-8 mb-5">
        {/* Step 0: Select Event */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-sm font-semibold text-text-primary">
              Select Certificate Design Template
            </h2>
            <div>
              <label className="block text-xs text-text-muted mb-1.5 font-medium">Event Template</label>
              <select
                className="w-full px-3 py-2 bg-bg border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent transition-colors duration-150"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                <option value="" disabled>
                  — Choose Event —
                </option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedEvent?.template_missing && (
              <div className="flex items-start gap-3 bg-danger/10 border border-danger/25 rounded-lg p-3 text-danger">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Template Image Missing</p>
                  <p className="text-xs mt-0.5">The design template image file is missing on the backend server. Please fix the template before launching a run.</p>
                </div>
              </div>
            )}
            {selectedEvent && (
              <div className="bg-bg border border-border rounded p-3">
                <p className="text-xs text-text-muted mb-1.5 uppercase tracking-wider font-semibold">
                  Fields in template
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEvent.fields && selectedEvent.fields.length > 0 ? (
                    selectedEvent.fields.map((f) => (
                      <span
                        key={f.id}
                        className="font-mono text-[11px] bg-accent-soft text-accent border border-accent/20 rounded px-2 py-0.5"
                      >
                        {f.placeholder}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-text-muted">No fields defined</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Upload Excel */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-sm font-semibold text-text-primary">
              Upload Excel Spreadsheet
            </h2>
            <label
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={[
                "flex flex-col items-center gap-3 border border-dashed rounded-lg p-8 cursor-pointer transition-colors duration-150",
                dragActive
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border hover:border-accent bg-bg"
              ].join(" ")}
            >
              <FileSpreadsheet size={24} className={excelFile || dragActive ? "text-accent" : "text-text-muted"} />
              <div className="text-center pointer-events-none">
                {excelFile ? (
                  <>
                    <p className="text-sm font-medium text-text-primary">{excelFile.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">Click to replace</p>
                  </>
                ) : dragActive ? (
                  <>
                    <p className="text-sm font-semibold">Drop the Excel sheet here!</p>
                    <p className="text-xs text-text-muted mt-0.5">Release to upload</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-muted">Click or drag .xlsx / .xls file here</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Headers must match template variable names (case-insensitive)
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  setExcelFile(e.target.files[0]);
                  setErrorMessage("");
                }}
              />
            </label>
          </div>
        )}

        {/* Step 2: Map email column */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-sm font-semibold text-text-primary">
              Map Recipient Email Column
            </h2>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-text-muted mb-1.5 font-medium">
                Email Column Name
                <span
                  title="The exact header name in your Excel sheet that contains email addresses"
                  className="cursor-help text-text-muted"
                >
                  <HelpCircle size={12} />
                </span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors duration-150"
                placeholder="e.g. Email, RecipientEmail, EmailAddress"
                value={emailColumn}
                onChange={(e) => setEmailColumn(e.target.value)}
              />
              <p className="text-xs text-text-muted mt-2">
                This column will be used as the delivery address for each certificate email.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-sm font-semibold text-text-primary mb-1">
              Confirm Run Parameters
            </h2>
            {[
              { label: "Event Template", value: selectedEvent?.name ?? "—" },
              { label: "Excel File", value: excelFile?.name ?? "—" },
              { label: "Email Column", value: emailColumn },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0"
              >
                <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                  {label}
                </span>
                <span className="font-mono text-sm text-text-primary">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-bg bg-accent rounded hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-bg bg-accent rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            {isSubmitting ? "Creating..." : "Create Run"}
          </button>
        )}
      </div>
    </div>
    </div>
  );
}
