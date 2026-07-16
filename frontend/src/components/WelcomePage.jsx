import React, { useState } from "react";
import { FileText, LogIn, ArrowRight, Moon, Sun, LoaderCircle } from "lucide-react";
import { API_BASE, setAuthSession } from "../auth";
import titusLogo from "../assets/titus-logo.png";

export default function WelcomePage({ darkMode, onToggleTheme, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [portal, setPortal] = useState("workspace");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Authentication failed");
      setAuthSession(data);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary px-5 py-10 overflow-auto">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <div className="w-full flex justify-end">
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 text-text-muted hover:text-text-primary border border-border rounded transition-colors"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="flex flex-col items-center text-center mt-4 mb-10">
          <div className="w-24 h-24 rounded-full bg-surface border border-border flex items-center justify-center shadow-sm overflow-hidden">
            <img src={titusLogo} alt="TITUS logo" className="w-full h-full object-cover" />
          </div>
          <p className="font-mono text-sm text-accent font-semibold tracking-wide mt-5">TITUS CERTIFICATE AUTOMATION</p>
          <h1 className="font-heading text-4xl md:text-5xl font-semibold tracking-tight mt-4">Welcome back</h1>
          <p className="text-base text-text-muted font-medium mt-3">Choose a workspace to continue</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 w-full max-w-4xl mb-8">
          <button
            type="button"
            onClick={() => setPortal("workspace")}
            className={`text-left bg-surface border rounded-xl p-7 transition-colors ${portal === "workspace" ? "border-accent shadow-sm" : "border-border hover:border-accent/60"}`}
          >
            <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center mb-6">
              <FileText size={24} className="text-accent" />
            </div>
            <h2 className="font-heading text-2xl font-semibold">Certificate workspace</h2>
            <p className="text-sm text-text-muted font-medium leading-relaxed mt-3">Build reusable templates, generate personalized PDFs, and manage delivery runs.</p>
            <span className="inline-flex items-center gap-2 text-sm text-accent font-semibold mt-6">Continue <ArrowRight size={15} /></span>
          </button>

          <button
            type="button"
            onClick={() => { setPortal("workspace"); setMode("login"); setError(""); }}
            className={`text-left bg-surface border rounded-xl p-7 transition-colors ${portal === "admin" ? "border-accent shadow-sm" : "border-border hover:border-accent/60"}`}
          >
            <div className="w-12 h-12 rounded-full bg-surface-alt flex items-center justify-center mb-6">
              <LogIn size={24} className="text-accent" />
            </div>
            <h2 className="font-heading text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-text-muted font-medium leading-relaxed mt-3">Already have a TITUS account? Continue to your certificate workspace.</p>
            <span className="inline-flex items-center gap-2 text-sm text-accent font-semibold mt-6">Sign in securely <ArrowRight size={15} /></span>
          </button>
        </div>

        <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-heading text-xl font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h2>
              <p className="text-xs text-text-muted font-medium mt-1">{portal === "admin" ? "Administration access" : "Certificate workspace access"}</p>
            </div>
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="text-xs text-accent font-semibold hover:underline">
              {mode === "login" ? "Create account" : "I have an account"}
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="bg-bg border border-border rounded px-3 py-2.5 text-sm text-text-primary font-medium focus:outline-none focus:border-accent" placeholder="you@example.com" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Password</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} className="bg-bg border border-border rounded px-3 py-2.5 text-sm text-text-primary font-medium focus:outline-none focus:border-accent" placeholder="At least 8 characters" />
            </label>
            {error && <p className="text-sm text-danger font-medium bg-danger/10 border border-danger/30 rounded p-2.5">{error}</p>}
            <button disabled={submitting} className="flex items-center justify-center gap-2 bg-accent text-bg rounded px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting && <LoaderCircle size={15} className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-xs text-text-muted font-medium mt-8">Secure access to your certificate operations</p>
      </div>
    </div>
  );
}
