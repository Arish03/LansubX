"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Activity, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Zap } from "lucide-react";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors cyber-grid-bg">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 shadow-2xl shadow-sky-500/30 mb-4 border border-white/20">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            LANSUB <span className="text-sky-400">X</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest font-mono">
            Industrial Telemetry & Supervisory Cockpit
          </p>
        </div>

        {/* Glass Card */}
        <div className="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top scanline accent */}
          <div className="scanline-effect" />

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950/60 p-1 mb-6 border border-slate-200/80 dark:border-white/10 font-mono">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                !isRegister
                  ? "bg-sky-600 text-white shadow-sm font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                isRegister
                  ? "bg-sky-600 text-white shadow-sm font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2 text-rose-500">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Operator Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@plant.lan"
                  className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl focus:outline-none font-sans"
                />
              </div>
            </div>

            {isRegister && (
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-600 dark:text-sky-300 flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-sky-500 flex-shrink-0" />
                <span>The first registered account automatically receives Administrator privileges.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-lg shadow-sky-600/30 flex items-center justify-center space-x-2 transition-all tracking-wider"
            >
              {submitting ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? "Create Account" : "Access Cockpit"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Badge Footer */}
        <p className="text-center text-[11px] text-slate-500 mt-6 font-mono">
          Mosquitto Broker ACL &bull; HS256 JWT &bull; Industrial Real-Time WebSockets
        </p>
      </div>
    </div>
  );
}
