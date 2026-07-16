import React, { useState } from "react";
import { Moon, Sun, LoaderCircle } from "lucide-react";
import { API_BASE, setAuthSession } from "../auth";
import titusLogo from "../assets/titus-logo.png";

function AuthCard({ mode, onAuthenticated }) {
  const isLogin = mode === "login";
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
    <section className="bg-surface border border-border rounded-xl p-7 shadow-sm">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-semibold">{isLogin ? "Sign in" : "Create account"}</h2>
        <p className="text-sm text-text-muted font-medium mt-1">Certificate workspace access</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="bg-bg border border-border rounded px-3 py-3 text-sm text-text-primary font-medium focus:outline-none focus:border-accent" placeholder="you@example.com" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} autoComplete={isLogin ? "current-password" : "new-password"} className="bg-bg border border-border rounded px-3 py-3 text-sm text-text-primary font-medium focus:outline-none focus:border-accent" placeholder="At least 8 characters" />
        </label>
        {error && <p className="text-sm text-danger font-medium bg-danger/10 border border-danger/30 rounded p-2.5">{error}</p>}
        <button disabled={submitting} className="flex items-center justify-center gap-2 bg-accent text-bg rounded px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 mt-1">
          {submitting && <LoaderCircle size={15} className="animate-spin" />}
          {isLogin ? "Sign in" : "Create account"}
        </button>
      </form>
    </section>
  );
}

export default function WelcomePage({ darkMode, onToggleTheme, onAuthenticated }) {
  return (
    <div className="min-h-screen bg-bg text-text-primary px-5 py-10 overflow-auto">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <div className="w-full flex justify-end">
          <button type="button" onClick={onToggleTheme} className="p-2 text-text-muted hover:text-text-primary border border-border rounded transition-colors" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="flex flex-col items-center text-center mt-4 mb-10">
          <div className="w-24 h-24 rounded-full bg-surface border border-border flex items-center justify-center shadow-sm overflow-hidden">
            <img src={titusLogo} alt="TITUS logo" className="w-full h-full object-cover" />
          </div>
          <p className="font-mono text-sm text-accent font-semibold tracking-wide mt-5">TITUS CERTIFICATE AUTOMATION</p>
          <h1 className="font-heading text-4xl md:text-5xl font-semibold tracking-tight mt-4">Welcome back</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-5 w-full max-w-4xl">
          <AuthCard mode="login" onAuthenticated={onAuthenticated} />
          <AuthCard mode="register" onAuthenticated={onAuthenticated} />
        </div>

        <p className="text-xs text-text-muted font-medium mt-8">Secure access to your certificate operations</p>
      </div>
    </div>
  );
}
