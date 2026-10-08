"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Activity, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-sky-600 shadow-xl shadow-sky-600/30 mb-4 border border-sky-400/20">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            LANSUB <span className="text-sky-400">X</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">
            Industrial Telemetry & Control Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-950/60 p-1 mb-6 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                !isRegister ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
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
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                isRegister ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 flex items-start space-x-2 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@plant.lan"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
                />
              </div>
            </div>

            {isRegister && (
              <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-300 flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-sky-400 flex-shrink-0" />
                <span>The first registered account automatically becomes the Administrator.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-medium rounded-lg text-sm shadow-lg shadow-sky-600/30 flex items-center justify-center space-x-2 transition-all"
            >
              {submitting ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? "Create Account" : "Access Platform"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security badge footer */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          Mosquitto Broker ACL &bull; HS256 Token Auth &bull; Scoped Multi-Tenant
        </p>
      </div>
    </div>
  );
}
