import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import {
  ArrowLeft, Save, Upload, Eye, Plus, Trash2, CheckCircle2, RefreshCw, Undo2, AlertCircle, ChevronDown, Type, X, ChevronUp,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";
const MAX_HISTORY = 20;

const RECOMMENDED_FONTS = new Set([
  "PlayfairDisplay-Regular.ttf",
  "CormorantGaramond-Regular.ttf",
  "Montserrat-Regular.ttf",
  "DancingScript-Regular.ttf",
  "GreatVibes-Regular.ttf",
  "EBGaramond-Regular.ttf",
  "Roboto-Regular.ttf",
  "arial.ttf",
]);

function fontFilenameToFamily(filename) {
  return `webfont__${filename.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function fontDisplayName(filename) {
  return filename
    .replace(/-Regular\.(ttf|otf)$/i, "")
    .replace(/\.(ttf|otf)$/i, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

// ─── Font Loader: injects @font-face rules for every known font ───────────────
function FontLoader({ fonts }) {
  useEffect(() => {
    if (!fonts || fonts.length === 0) return;

    const styleId = "webfont-face-rules";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const rules = fonts
      .filter((f) => f !== "arial.ttf") // arial is a system font
      .map((filename) => {
        const family = fontFilenameToFamily(filename);
        const url = `${API_BASE}/api/fonts/file/${encodeURIComponent(filename)}`;
        return `@font-face { font-family: '${family}'; src: url('${url}') format('truetype'); font-display: swap; }`;
      })
      .join("\n");

    styleEl.textContent = rules;
  }, [fonts]);

  return null;
}

const DEFAULT_FIELD = (idx) => ({
  placeholder: `Field${idx + 1}`,
  x: 100,
  y: 100,
  width: 400,
  height: 60,
  font_size: 48,
  font_path: "Roboto-Regular.ttf",
  font_color: "#000000",
  format_type: "as_is",
  format_config: "",
  font_filename: null,
  vertical_offset: 0,
});

const HANDLES = [
  { name: "nw", cursor: "nwse-resize", style: { top: -4, left: -4 } },
  { name: "n",  cursor: "ns-resize",   style: { top: -4, left: "50%", transform: "translateX(-50%)" } },
  { name: "ne", cursor: "nesw-resize", style: { top: -4, right: -4 } },
  { name: "e",  cursor: "ew-resize",   style: { top: "50%", right: -4, transform: "translateY(-50%)" } },
  { name: "se", cursor: "nwse-resize", style: { bottom: -4, right: -4 } },
  { name: "s",  cursor: "ns-resize",   style: { bottom: -4, left: "50%", transform: "translateX(-50%)" } },
  { name: "sw", cursor: "nesw-resize", style: { bottom: -4, left: -4 } },
  { name: "w",  cursor: "ew-resize",   style: { top: "50%", left: -4, transform: "translateY(-50%)" } },
];

// ─── Custom Font Dropdown (renders each option in its own typeface) ────────────
const FontDropdown = memo(function FontDropdown({ value, fonts, onSelect, onRefresh, onUpload }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const effectiveFont = value || "Roboto-Regular.ttf";
  const displayName = fontDisplayName(effectiveFont);
  const fontFamily = effectiveFont === "arial.ttf" ? "Arial, sans-serif" : `'${fontFilenameToFamily(effectiveFont)}', sans-serif`;

  useEffect(() => {
    if (!open) return;
    onRefresh?.();
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onRefresh]);

  const recommendedFonts = fonts.filter((f) => RECOMMENDED_FONTS.has(f));
  const customFonts = fonts.filter((f) => !RECOMMENDED_FONTS.has(f));

  const renderOption = (font) => {
    const fFamily = font === "arial.ttf" ? "Arial, sans-serif" : `'${fontFilenameToFamily(font)}', sans-serif`;
    const selected = effectiveFont === font;
    return (
      <div
        key={font}
        onMouseDown={(e) => { e.preventDefault(); onSelect(font); setOpen(false); }}
        style={{ fontFamily: fFamily, cursor: "pointer" }}
        className={[
          "px-3 py-2 text-sm transition-colors duration-75 hover:bg-surface-alt",
          selected ? "text-accent font-semibold bg-surface-alt" : "text-text-primary",
        ].join(" ")}
      >
        {fontDisplayName(font)}
        {selected && <span className="ml-1 text-xs">✓</span>}
      </div>
    );
  };

  return (
    <div ref={dropdownRef} className="relative w-full" onClick={(e) => e.stopPropagation()}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent hover:border-text-muted transition-colors duration-100"
        style={{ fontFamily, minHeight: "34px" }}
      >
        <span className="truncate text-text-primary">{displayName}</span>
        <ChevronDown size={12} className={`ml-1 text-text-muted transition-transform duration-150 flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-2xl overflow-hidden" style={{ maxHeight: "280px", overflowY: "auto" }}>
          {recommendedFonts.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-text-muted font-bold bg-bg sticky top-0 border-b border-border">
                Recommended
              </div>
              {recommendedFonts.map(renderOption)}
            </>
          )}
          {customFonts.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-text-muted font-bold bg-bg sticky top-0 border-b border-border border-t">
                Custom Fonts
              </div>
              {customFonts.map(renderOption)}
            </>
          )}
          <div className="border-t border-border">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); onUpload?.(); }}
              className="w-full text-left px-3 py-2 text-xs text-accent font-medium hover:bg-surface-alt transition-colors"
            >
              + Upload font...
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Text overlay: renders the preview text directly on the canvas ────────────
const TextOverlay = memo(function TextOverlay({ field, naturalSize, previewText }) {
  if (!previewText) return null;

  const pctX = (field.x / naturalSize.width) * 100;
  const pctY = (field.y / naturalSize.height) * 100;
  const pctW = (field.width / naturalSize.width) * 100;
  const pctH = (field.height / naturalSize.height) * 100;

  const effectiveFont = field.font_filename || field.font_path || "Roboto-Regular.ttf";
  const fontFamily = effectiveFont === "arial.ttf" ? "Arial, sans-serif" : `'${fontFilenameToFamily(effectiveFont)}', sans-serif`;

  // Scale font size from image pixels to percentage of container
  // We scale relative to image natural width to maintain proportions
  const scaledFontSize = (field.font_size / naturalSize.width) * 100;
  const verticalOffsetPct = ((field.vertical_offset || 0) / naturalSize.height) * 100;

  return (
    <div
      style={{
        position: "absolute",
        left: `${pctX}%`,
        top: `${pctY + verticalOffsetPct}%`,
        width: `${pctW}%`,
        height: `${pctH}%`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontFamily,
          fontSize: `${scaledFontSize}vw`,
          color: field.font_color || "#000000",
          whiteSpace: "nowrap",
          lineHeight: 1,
          userSelect: "none",
          textAlign: "center",
          maxWidth: "100%",
        }}
      >
        {previewText}
      </span>
    </div>
  );
});

// ─── Memoised FieldPin ────────────────────────────────────────────────────────
const FieldPin = memo(function FieldPin({
  field, idx, isSelected, naturalSize, onSelect, onDelete, onDragStart,
}) {
  const pctX = (field.x / naturalSize.width) * 100;
  const pctY = (field.y / naturalSize.height) * 100;
  const pctW = (field.width / naturalSize.width) * 100;
  const pctH = (field.height / naturalSize.height) * 100;

  const accent = "rgb(var(--color-accent))";
  const muted  = "rgb(var(--color-text-muted))";
  const borderC = "rgb(var(--color-border))";

  return (
    <div
      style={{
        position: "absolute",
        left: `${pctX}%`,
        top: `${pctY}%`,
        width: `${pctW}%`,
        height: `${pctH}%`,
        border: isSelected ? `2px solid ${accent}` : `1px dashed ${borderC}`,
        borderRadius: "3px",
        cursor: "move",
        pointerEvents: "all",
        boxSizing: "border-box",
        backgroundColor: isSelected ? "rgba(192, 92, 54, 0.04)" : "rgba(0, 0, 0, 0.01)",
        boxShadow: isSelected ? `0 0 8px rgba(192, 92, 54, 0.2)` : "none",
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect(idx);
        onDragStart(e, idx, "move");
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(idx);
      }}
    >
      {/* 8 Drag handles */}
      {isSelected && HANDLES.map((h) => (
        <div
          key={h.name}
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            background: "#fff",
            border: `2px solid ${accent}`,
            borderRadius: "1px",
            cursor: h.cursor,
            pointerEvents: "all",
            boxSizing: "border-box",
            ...h.style,
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onDragStart(e, idx, "resize", h.name);
          }}
        />
      ))}

      {/* Label */}
      <div style={{
        position: "absolute",
        top: -22,
        left: 0,
        background: "#fff",
        border: `1px solid ${isSelected ? accent : "rgba(107, 104, 98, 0.2)"}`,
        color: isSelected ? accent : muted,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "10px",
        padding: "1px 6px",
        borderRadius: "3px",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 10,
      }}>
        {idx + 1}. {field.placeholder}
      </div>
    </div>
  );
});

// ─── Memoised FieldRow (compact list item, not expanded panel) ─────────────────
const FieldRow = memo(function FieldRow({ field, idx, isSelected, onSelect }) {
  const accent = "rgb(var(--color-accent))";
  const effectiveFont = field.font_filename || field.font_path || "Roboto-Regular.ttf";
  const fontFamily = effectiveFont === "arial.ttf" ? "Arial, sans-serif" : `'${fontFilenameToFamily(effectiveFont)}', sans-serif`;

  return (
    <div
      onClick={() => onSelect(idx)}
      className={[
        "flex items-center px-4 py-2.5 border-b border-border cursor-pointer transition-colors duration-100 gap-3",
        isSelected ? "bg-surface-alt" : "hover:bg-surface-alt",
      ].join(" ")}
      style={{
        borderLeft: isSelected ? `2px solid ${accent}` : "2px solid transparent",
      }}
    >
      <span className="font-mono text-xs text-text-muted w-5 flex-shrink-0">{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary font-medium truncate">{field.placeholder}</div>
        <div className="text-[10px] text-text-muted font-mono mt-0.5 flex items-center gap-2">
          <span style={{ fontFamily }} className="truncate max-w-[80px]">{fontDisplayName(effectiveFont)}</span>
          <span>·</span>
          <span>{field.font_size}px</span>
          {field.format_type && field.format_type !== "as_is" && (
            <><span>·</span><span className="text-accent">{field.format_type}</span></>
          )}
        </div>
      </div>
      <div
        className="w-3 h-3 rounded-full border border-border flex-shrink-0"
        style={{ backgroundColor: field.font_color || "#000000" }}
        title={field.font_color}
      />
    </div>
  );
});

// ─── Unified Field Settings Panel ─────────────────────────────────────────────
const FieldSettingsPanel = memo(function FieldSettingsPanel({
  field, idx, availableFonts, onChange, onFontSelect, onRefreshFonts, onUploadFont,
}) {
  if (!field) return null;

  return (
    <div className="flex flex-col gap-3 p-4 border-t border-border bg-bg" onClick={(e) => e.stopPropagation()}>
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Type size={12} className="text-accent" />
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Text Properties</span>
      </div>

      {/* Field name */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase font-mono text-text-muted font-bold">Field Name</label>
        <input
          type="text"
          value={field.placeholder}
          onChange={(e) => onChange(idx, "placeholder", e.target.value)}
          className="bg-surface border border-border text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent text-text-primary w-full font-medium"
          placeholder="Field Name"
        />
      </div>

      {/* Font picker */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase font-mono text-text-muted font-bold">Font</label>
        <FontDropdown
          value={field.font_filename || field.font_path || "Roboto-Regular.ttf"}
          fonts={availableFonts}
          onSelect={(font) => onFontSelect(idx, font)}
          onRefresh={onRefreshFonts}
          onUpload={onUploadFont}
        />
      </div>

      {/* Size + Color row */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-[9px] uppercase font-mono text-text-muted font-bold">Size</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={field.font_size}
              min={10}
              max={120}
              onChange={(e) => onChange(idx, "font_size", Math.min(120, Math.max(10, parseInt(e.target.value) || 10)))}
              className="bg-surface border border-border text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent text-text-primary w-16 font-mono text-center"
            />
            <input
              type="range"
              min={10}
              max={120}
              value={field.font_size}
              onChange={(e) => onChange(idx, "font_size", parseInt(e.target.value))}
              className="flex-1 h-1 accent-orange-600 cursor-pointer"
              style={{ accentColor: "#C05C36" }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 items-center">
          <label className="text-[9px] uppercase font-mono text-text-muted font-bold">Color</label>
          <div className="relative">
            <input
              type="color"
              value={field.font_color || "#000000"}
              onChange={(e) => onChange(idx, "font_color", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-surface"
              title="Font color"
            />
          </div>
        </div>
      </div>

      {/* Vertical offset */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase font-mono text-text-muted font-bold">Vertical Offset (px)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={field.vertical_offset ?? 0}
            onChange={(e) => onChange(idx, "vertical_offset", parseInt(e.target.value) || 0)}
            className="bg-surface border border-border text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent text-text-primary w-20 font-mono text-center"
            placeholder="0"
          />
          <span className="text-[10px] text-text-muted">↑ negative / ↓ positive</span>
        </div>
      </div>

      {/* Position + Size grid */}
      <div className="grid grid-cols-4 gap-2">
        {[["X", "x"], ["Y", "y"], ["W", "width"], ["H", "height"]].map(([label, key]) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-mono text-text-muted font-bold text-center">{label}</label>
            <input
              type="number"
              value={field[key]}
              onChange={(e) => onChange(idx, key, e.target.value)}
              className="font-mono text-xs text-text-muted bg-surface border border-border rounded px-1.5 py-1 w-full focus:outline-none focus:border-accent text-center"
            />
          </div>
        ))}
      </div>

      {/* Format type + custom map */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] uppercase font-mono text-text-muted font-bold">Value Format</label>
        <select
          value={field.format_type || "as_is"}
          onChange={(e) => onChange(idx, "format_type", e.target.value)}
          className="bg-surface border border-border text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent text-text-primary w-full"
        >
          <option value="as_is">As Is</option>
          <option value="roman_numeral">Roman Numeral</option>
          <option value="ordinal">Ordinal</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="title_case">Title Case</option>
          <option value="custom_map">Custom Map</option>
        </select>

        {field.format_type === "custom_map" && (
          <textarea
            value={field.format_config || ""}
            onChange={(e) => onChange(idx, "format_config", e.target.value)}
            placeholder='{"1": "Gold", "2": "Silver"}'
            className="w-full bg-surface border border-border text-xs font-mono rounded p-1.5 focus:outline-none focus:border-accent h-16 text-text-primary resize-y"
          />
        )}
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EventSetup({ eventId, onNavigate, onRefreshEvents }) {
  const [name, setName] = useState("");
  const [templateFile, setTemplateFile] = useState(null);
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
      if (file.type.startsWith("image/")) {
        setTemplateFile(file);
      } else {
        alert("Please upload a valid image file (PNG, JPG, JPEG).");
      }
    }
  }, []);

  const [activeEvent, setActiveEvent] = useState(null);
  const [templateUpdatedWarning, setTemplateUpdatedWarning] = useState(false);
  const replaceFileInputRef = useRef(null);

  const [availableFonts, setAvailableFonts] = useState(["Roboto-Regular.ttf", "arial.ttf"]);
  const [previewValues, setPreviewValues] = useState({});
  const fontFileInputRef = useRef(null);
  const uploadingFontFieldIdxRef = useRef(null);

  const refreshFonts = useCallback(() => {
    fetch(`${API_BASE}/api/fonts`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          setAvailableFonts(data);
        }
      })
      .catch(err => console.error("Error loading fonts:", err));
  }, []);

  useEffect(() => {
    refreshFonts();
  }, [refreshFonts]);

  const [fields, setFields] = useState([
    { placeholder: "Full Name", x: 600, y: 350, width: 400, height: 60, font_size: 48, font_path: "Roboto-Regular.ttf", font_color: "#000000", format_type: "as_is", format_config: "", font_filename: null, vertical_offset: 0 },
  ]);

  const handleReplaceTemplateFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeEvent) return;

    const formData = new FormData();
    formData.append("template", file);

    try {
      const res = await fetch(`${API_BASE}/api/events/${activeEvent.id}/template`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to replace template image");
      const updatedEvent = await res.json();
      setActiveEvent(updatedEvent);
      setTemplateUpdatedWarning(true);
      onRefreshEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  // History stack for undo (stores snapshots of fields)
  const historyRef = useRef([]);

  const pushHistory = useCallback((snapshot) => {
    historyRef.current = [
      ...historyRef.current.slice(-MAX_HISTORY + 1),
      snapshot,
    ];
  }, []);

  const [selectedFieldIdx, setSelectedFieldIdx] = useState(0);
  const selectedFieldIdxRef = useRef(0);
  const updateSelectedIdx = useCallback((idx) => {
    selectedFieldIdxRef.current = idx;
    setSelectedFieldIdx(idx);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const naturalSizeRef = useRef({ width: 1, height: 1 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const imageRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const [draftBox, setDraftBox] = useState(null);

  // ── Load event ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    fetch(`${API_BASE}/api/events/${eventId}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((data) => {
        setActiveEvent(data);
        setName(data.name);
        if (data.fields?.length > 0) {
          setFields(data.fields.map((f) => ({
            placeholder: f.placeholder,
            x: f.x, y: f.y,
            width: f.width ?? 400,
            height: f.height ?? 60,
            font_size: f.font_size,
            font_path: f.font_path,
            font_color: f.font_color,
            format_type: f.format_type || "as_is",
            format_config: f.format_config || "",
            font_filename: f.font_filename || null,
            vertical_offset: f.vertical_offset ?? 0,
          })));
        }
      })
      .catch((e) => console.error("Error loading event:", e));
  }, [eventId]);

  const handleRemoveField = useCallback((index) => {
    setFields((prev) => {
      if (prev.length <= 1) return prev;
      pushHistory(prev);
      const updated = prev.filter((_, i) => i !== index);
      updateSelectedIdx(Math.max(0, Math.min(index, updated.length - 1)));
      return updated;
    });
  }, [pushHistory, updateSelectedIdx]);

  // ── Keydown events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (historyRef.current.length === 0) return;
        const prev = historyRef.current.pop();
        setFields(prev);
        updateSelectedIdx(Math.min(selectedFieldIdxRef.current, prev.length - 1));
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const active = document.activeElement;
        const isInput = active && (
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable
        );
        if (!isInput) {
          e.preventDefault();
          handleRemoveField(selectedFieldIdxRef.current);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [updateSelectedIdx, handleRemoveField]);

  const handleImageLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.target;
    const size = { width: w || 1, height: h || 1 };
    setNaturalSize(size);
    naturalSizeRef.current = size;
    setImageLoaded(true);
  };

  // ── Mutators ────────────────────────────────────────────────────────────────
  const handleFieldChange = useCallback((index, key, value) => {
    setFields((prev) => {
      pushHistory(prev);
      const updated = prev.map((f, i) =>
        i === index
          ? { ...f, [key]: (["x", "y", "font_size", "width", "height"].includes(key)) ? (parseInt(value) || 0) : value }
          : f
      );
      return updated;
    });
  }, [pushHistory]);

  const handleFontSelect = useCallback((idx, value) => {
    if (value === "__upload__") {
      uploadingFontFieldIdxRef.current = idx;
      fontFileInputRef.current?.click();
    } else {
      handleFieldChange(idx, "font_filename", value);
    }
  }, [handleFieldChange]);

  const triggerFontUpload = useCallback((idxOverride) => {
    if (idxOverride !== undefined) uploadingFontFieldIdxRef.current = idxOverride;
    fontFileInputRef.current?.click();
  }, []);

  const handleFontUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "ttf" && ext !== "otf") {
      alert("Only .ttf and .otf font files are supported.");
      return;
    }
    const formData = new FormData();
    formData.append("font_file", file);
    try {
      const res = await fetch(`${API_BASE}/api/fonts`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload font");
      const data = await res.json();
      setAvailableFonts(data);

      const idx = uploadingFontFieldIdxRef.current;
      if (idx !== null && idx !== undefined) {
        handleFieldChange(idx, "font_filename", file.name);
      }
    } catch (err) {
      alert(err.message);
    }
    e.target.value = "";
  };

  const handleAddField = useCallback(() => {
    setFields((prev) => {
      pushHistory(prev);
      const newFields = [...prev, DEFAULT_FIELD(prev.length)];
      updateSelectedIdx(newFields.length - 1);
      return newFields;
    });
  }, [pushHistory, updateSelectedIdx]);

  // ── Drag/Resize handlers ────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, index, type, handle = null) => {
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startField = { ...fields[index] };

    pushHistory(fields);

    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = naturalSizeRef.current.width / rect.width;
    const scaleY = naturalSizeRef.current.height / rect.height;

    const handleMouseMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX;
      const dy = (moveEvent.clientY - startY) * scaleY;

      setFields((prev) => {
        return prev.map((f, i) => {
          if (i !== index) return f;

          let nextX = startField.x;
          let nextY = startField.y;
          let nextW = startField.width;
          let nextH = startField.height;

          if (type === "move") {
            nextX = Math.round(startField.x + dx);
            nextY = Math.round(startField.y + dy);
          } else if (type === "resize") {
            switch (handle) {
              case "se": nextW = Math.round(startField.width + dx); nextH = Math.round(startField.height + dy); break;
              case "s": nextH = Math.round(startField.height + dy); break;
              case "e": nextW = Math.round(startField.width + dx); break;
              case "sw": nextX = Math.round(startField.x + dx); nextW = Math.round(startField.width - dx); nextH = Math.round(startField.height + dy); break;
              case "w": nextX = Math.round(startField.x + dx); nextW = Math.round(startField.width - dx); break;
              case "nw": nextX = Math.round(startField.x + dx); nextY = Math.round(startField.y + dy); nextW = Math.round(startField.width - dx); nextH = Math.round(startField.height - dy); break;
              case "n": nextY = Math.round(startField.y + dy); nextH = Math.round(startField.height - dy); break;
              case "ne": nextY = Math.round(startField.y + dy); nextW = Math.round(startField.width + dx); nextH = Math.round(startField.height - dy); break;
            }

            if (nextW < 10) { if (["sw", "w", "nw"].includes(handle)) nextX = startField.x + startField.width - 10; nextW = 10; }
            if (nextH < 10) { if (["nw", "n", "ne"].includes(handle)) nextY = startField.y + startField.height - 10; nextH = 10; }
          }

          return { ...f, x: nextX, y: nextY, width: nextW, height: nextH };
        });
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [fields, pushHistory]);

  // ── Canvas draw-box ──────────────────────────────────────────────────────────
  const clientToImageCoords = useCallback((clientX, clientY) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const { width: natW, height: natH } = naturalSizeRef.current;
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * natW),
      y: Math.round(((clientY - rect.top) / rect.height) * natH),
    };
  }, []);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = clientToImageCoords(e.clientX, e.clientY);
    isDraggingRef.current = true;
    dragStartRef.current = start;
    setDraftBox({ x: start.x, y: start.y, width: 0, height: 0 });
  }, [clientToImageCoords]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const cur = clientToImageCoords(e.clientX, e.clientY);
      const { x: sx, y: sy } = dragStartRef.current;
      setDraftBox({
        x: Math.min(sx, cur.x),
        y: Math.min(sy, cur.y),
        width: Math.abs(cur.x - sx),
        height: Math.abs(cur.y - sy),
      });
    });
  }, [clientToImageCoords]);

  const handleCanvasMouseUp = useCallback((e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setDraftBox(null);

    const cur = clientToImageCoords(e.clientX, e.clientY);
    const { x: sx, y: sy } = dragStartRef.current;
    const boxX = Math.min(sx, cur.x);
    const boxY = Math.min(sy, cur.y);
    const boxW = Math.abs(cur.x - sx);
    const boxH = Math.abs(cur.y - sy);

    if (boxW < 10 && boxH < 10) {
      setFields((prev) => {
        pushHistory(prev);
        return prev.map((f, i) =>
          i === selectedFieldIdxRef.current ? { ...f, x: sx, y: sy } : f
        );
      });
    } else {
      setFields((prev) => {
        pushHistory(prev);
        return prev.map((f, i) =>
          i === selectedFieldIdxRef.current ? { ...f, x: boxX, y: boxY, width: boxW, height: boxH } : f
        );
      });
    }
  }, [clientToImageCoords, pushHistory]);

  const draftBoxPct = useMemo(() => {
    if (!draftBox || !naturalSizeRef.current) return null;
    const { width: nw, height: nh } = naturalSizeRef.current;
    return {
      left: `${(draftBox.x / nw) * 100}%`,
      top: `${(draftBox.y / nh) * 100}%`,
      width: `${(draftBox.width / nw) * 100}%`,
      height: `${(draftBox.height / nh) * 100}%`,
    };
  }, [draftBox]);

  // ── API handlers ────────────────────────────────────────────────────────────
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!name || (!eventId && !templateFile)) {
      alert("Please fill in all fields and choose a template image."); return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("name", name);
    if (templateFile) formData.append("template", templateFile);
    try {
      const res = await fetch(`${API_BASE}/api/events`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to upload event template");
      const data = await res.json();
      setActiveEvent(data);
      onRefreshEvents();
    } catch (err) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveFields = async () => {
    if (!activeEvent) return;
    setIsSubmitting(true); setSaveSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/events/${activeEvent.id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed to save fields");
      onRefreshEvents();
      setSaveSuccess(true);
      setTemplateUpdatedWarning(false);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleGeneratePreview = async () => {
    if (!activeEvent) return;
    setIsGeneratingPreview(true);
    try {
      const res = await fetch(`${API_BASE}/api/events/${activeEvent.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, preview_values: previewValues }),
      });
      if (!res.ok) throw new Error("Failed to generate preview");
      const data = await res.json();
      setPreviewUrl(`${API_BASE}/${data.preview_url}`);
    } catch (err) { alert(err.message); }
    finally { setIsGeneratingPreview(false); }
  };

  const selectedField = fields[selectedFieldIdx];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 h-full w-full">
      {/* Inject @font-face rules for all available fonts */}
      <FontLoader fonts={availableFonts} />

      {/* Page header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => onNavigate("dashboard")}
          className="p-1.5 text-text-muted hover:text-text-primary border border-border rounded transition-colors duration-150"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-heading text-2xl text-text-primary tracking-tight">
            {eventId ? `Edit: ${name}` : "Create Event Template"}
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Click inside box to move · Drag any of 8 handles to resize · Press Delete/Backspace to remove selected field · Ctrl+Z to undo
          </p>
        </div>
      </div>

      {/* ── Upload step ── */}
      {!activeEvent && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-border text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-bg border border-border mb-4">
                  <Upload size={20} className="text-accent" />
                </div>
                <h2 className="font-heading text-lg text-text-primary">Upload Template Image</h2>
                <p className="text-xs text-text-muted mt-1">Upload your Canva / PNG certificate design to get started.</p>
              </div>
              <form onSubmit={handleCreateEvent} className="px-8 py-6 flex flex-col gap-5">
                <div>
                  <label className="block text-xs text-text-muted mb-2 font-medium uppercase tracking-widest">Event Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-bg border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors duration-150"
                    placeholder="e.g. AI Bootcamp Certificate"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-2 font-medium uppercase tracking-widest">Template PNG / JPG</label>
                  <label
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={[
                      "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg py-10 px-6 cursor-pointer transition-colors duration-150",
                      dragActive
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border hover:border-accent hover:bg-bg bg-bg"
                    ].join(" ")}
                  >
                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                      <Upload size={28} className={templateFile || dragActive ? "text-accent" : "text-text-muted"} />
                      {templateFile ? (
                        <><span className="text-sm font-medium text-text-primary">{templateFile.name}</span><span className="text-xs text-text-muted">Click to replace</span></>
                      ) : dragActive ? (
                        <><span className="text-sm font-semibold">Drop the image here!</span><span className="text-xs text-text-muted">Release to upload</span></>
                      ) : (
                        <><span className="text-sm text-text-primary font-medium">Click or drag image here</span><span className="text-xs text-text-muted">PNG, JPG, or JPEG · any resolution</span></>
                      )}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setTemplateFile(e.target.files[0])} />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 text-sm font-semibold text-white bg-accent rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Uploading..." : "Upload and Continue"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 60/40 editor split ── */}
      {activeEvent && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Canvas (60%) */}
          <div className="flex flex-col gap-2" style={{ flex: "0 0 60%" }}>
            <div className="flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-text-muted font-mono">
                Drag to draw box · drag body to move · drag handles to resize · {naturalSize.width}×{naturalSize.height}px
              </span>
              <span className="text-xs text-text-muted font-mono">
                Active: <span className="text-accent">{selectedField?.placeholder ?? "—"}</span>
              </span>
            </div>

            {activeEvent?.template_missing && (
              <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-lg p-3 text-danger mb-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span className="text-xs font-medium">
                  The design template image for this event is missing on the server disk.
                </span>
              </div>
            )}

            {templateUpdatedWarning && (
              <div className="flex items-center gap-2.5 bg-warning/10 border border-warning/25 rounded-lg p-3 text-warning mb-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span className="text-xs font-medium">
                  Template image replaced. Please check that your field boxes are still positioned correctly, then click "Save" to commit.
                </span>
              </div>
            )}

            {/* Canvas container */}
            <div
              className="bg-bg border border-border rounded-lg overflow-auto flex-1 flex items-center justify-center p-4"
              style={{ cursor: "crosshair" }}
            >
              <div
                className="relative select-none"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  aspectRatio: `${naturalSize.width} / ${naturalSize.height}`,
                  margin: "0 auto"
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              >
                <img
                  ref={imageRef}
                  src={`${API_BASE}/api/events/${activeEvent.id}/template-image?v=${encodeURIComponent(activeEvent.template_path)}`}
                  alt="Template Canvas"
                  className="w-full h-full block pointer-events-none"
                  onLoad={handleImageLoad}
                  draggable={false}
                />

                {/* Field boxes */}
                {imageLoaded && fields.map((field, idx) => (
                  <FieldPin
                    key={idx}
                    field={field}
                    idx={idx}
                    isSelected={idx === selectedFieldIdx}
                    naturalSize={naturalSize}
                    onSelect={updateSelectedIdx}
                    onDelete={handleRemoveField}
                    onDragStart={handleDragStart}
                  />
                ))}

                {/* LIVE TEXT OVERLAYS — one per field with a test value */}
                {imageLoaded && fields.map((field, idx) => {
                  const testVal = previewValues[field.placeholder];
                  return (
                    <TextOverlay
                      key={`overlay-${idx}`}
                      field={field}
                      naturalSize={naturalSize}
                      previewText={testVal}
                    />
                  );
                })}

                {/* Draft box while dragging on canvas background */}
                {draftBoxPct && (
                  <div style={{
                    position: "absolute",
                    left: draftBoxPct.left,
                    top: draftBoxPct.top,
                    width: draftBoxPct.width,
                    height: draftBoxPct.height,
                     border: "2px dashed rgb(var(--color-accent))",
                    borderRadius: "3px",
                    background: "rgba(192, 92, 54, 0.08)",
                    pointerEvents: "none",
                  }} />
                )}
              </div>
            </div>
          </div>

          {/* Inspector (40%) */}
          <div
            className="flex flex-col bg-surface border border-border rounded-lg overflow-hidden"
            style={{ flex: "0 0 40%" }}
          >
            {/* Inspector header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0 gap-2">
              <span className="text-xs uppercase tracking-widest text-text-muted font-semibold">Field Inspector</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => replaceFileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150"
                  title="Replace template background image"
                >
                  <Upload size={12} /> Replace Image
                </button>
                <input
                  type="file"
                  ref={replaceFileInputRef}
                  onChange={handleReplaceTemplateFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={fontFileInputRef}
                  onChange={handleFontUpload}
                  accept=".ttf,.otf"
                  className="hidden"
                />
                <button
                  onClick={handleGeneratePreview}
                  disabled={isGeneratingPreview}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150 disabled:opacity-40"
                >
                  {isGeneratingPreview
                    ? <><RefreshCw size={12} className="animate-spin" /> Generating...</>
                    : <><Eye size={12} /> Preview PDF</>
                  }
                </button>
              </div>
            </div>

            {/* Test value input for selected field → drives live overlay */}
            {selectedField && (
              <div className="px-4 py-2 border-b border-border bg-surface-alt flex items-center justify-between gap-3 flex-shrink-0">
                <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider font-semibold flex-shrink-0">
                  Preview text:
                </span>
                <input
                  type="text"
                  value={previewValues[selectedField.placeholder] || ""}
                  onChange={(e) => setPreviewValues(prev => ({
                    ...prev,
                    [selectedField.placeholder]: e.target.value
                  }))}
                  placeholder={`e.g. for "${selectedField.placeholder}"`}
                  className="bg-surface border border-border text-xs rounded px-2 py-0.5 focus:outline-none focus:border-accent text-text-primary flex-1 font-sans"
                />
              </div>
            )}

            {/* Field list (compact rows) */}
            <div className="px-4 py-2 border-b border-border sticky top-0 bg-surface-alt flex-shrink-0 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Active Fields</span>
              <span className="text-[10px] text-text-muted font-mono">{fields.length} total</span>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col min-h-0">
              {/* Compact field rows */}
              <div>
                {fields.map((field, idx) => (
                  <FieldRow
                    key={idx}
                    field={field}
                    idx={idx}
                    isSelected={idx === selectedFieldIdx}
                    onSelect={updateSelectedIdx}
                  />
                ))}
              </div>

              {/* Unified settings panel for selected field */}
              {selectedField && (
                <FieldSettingsPanel
                  field={selectedField}
                  idx={selectedFieldIdx}
                  availableFonts={availableFonts}
                  onChange={handleFieldChange}
                  onFontSelect={handleFontSelect}
                  onRefreshFonts={refreshFonts}
                  onUploadFont={() => triggerFontUpload(selectedFieldIdx)}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-border p-3 flex items-center gap-2">
              <button
                onClick={handleAddField}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150"
              >
                <Plus size={12} /> Add Field
              </button>
              {fields.length > 1 && (
                <button
                  onClick={() => handleRemoveField(selectedFieldIdx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted border border-border rounded hover:text-danger hover:border-danger transition-colors duration-150"
                >
                  <Trash2 size={12} /> Remove #{selectedFieldIdx + 1}
                </button>
              )}
              <button
                onClick={() => {
                  if (historyRef.current.length === 0) return;
                  const prev = historyRef.current.pop();
                  setFields(prev);
                  updateSelectedIdx(Math.min(selectedFieldIdxRef.current, prev.length - 1));
                }}
                disabled={historyRef.current.length === 0}
                title="Undo (Ctrl+Z)"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors duration-150 disabled:opacity-30"
              >
                <Undo2 size={12} />
              </button>
              <div className="flex-1" />
              {saveSuccess && (
                <span className="text-xs text-accent font-mono flex items-center gap-1">
                  <CheckCircle2 size={12} /> Saved
                </span>
              )}
              <button
                onClick={handleSaveFields}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent rounded hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                <Save size={12} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview iframe */}
      {previewUrl && (
        <div
          className="flex-shrink-0 border border-border rounded-lg overflow-hidden transition-all duration-200"
          style={{ height: previewCollapsed ? "42px" : "420px" }}
        >
          <div className="px-4 py-2.5 border-b border-border bg-surface-alt flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-text-muted font-semibold">Sample Rendered PDF</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewCollapsed(c => !c)}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors duration-100"
                title={previewCollapsed ? "Expand preview" : "Collapse preview"}
              >
                <ChevronUp size={14} className={`transition-transform duration-200 ${previewCollapsed ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={() => { setPreviewUrl(null); setPreviewCollapsed(false); }}
                className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors duration-100"
                title="Close preview"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {!previewCollapsed && (
            <iframe
              src={previewUrl}
              title="PDF Preview"
              className="pdf-iframe"
              style={{ height: "calc(100% - 42px)", width: "100%" }}
            />
          )}
        </div>
      )}
    </div>
  );
}
