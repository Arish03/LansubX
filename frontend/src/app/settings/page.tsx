"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Settings, User, Shield, Server, ExternalLink, Check, Copy, Radio, Sun, Moon } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [copiedTopic, setCopiedTopic] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTopic(true);
    setTimeout(() => setCopiedTopic(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-2 border-b border-slate-200/40 dark:border-slate-800/60">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Platform Settings & Security
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
          Account credentials, role permissions, theme modes, and MQTT broker configuration
        </p>
      </div>

      {/* Account Info Card */}
      <div className="glass-card rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Operator Account</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Authentication & Role-Based Access Control</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-2">
          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10">
            <span className="text-slate-500 uppercase text-[10px] block">Email Address</span>
            <span className="text-slate-900 dark:text-white font-semibold">{user?.email}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10">
            <span className="text-slate-500 uppercase text-[10px] block">Assigned Role</span>
            <span className="text-sky-500 dark:text-sky-400 font-bold uppercase">{user?.role}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10">
            <span className="text-slate-500 uppercase text-[10px] block">User ID</span>
            <span className="text-slate-700 dark:text-slate-300">#{user?.id}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10">
            <span className="text-slate-500 uppercase text-[10px] block">Account Created</span>
            <span className="text-slate-700 dark:text-slate-300">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Appearance & Theme Card */}
      <div className="glass-card rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Appearance & Theme Engine</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Select preferred visual style with glassmorphic depth</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <button
            onClick={() => setTheme("light")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              theme === "light"
                ? "border-sky-500 bg-sky-500/10 shadow-glow-cyan"
                : "border-slate-200/80 dark:border-white/10 bg-slate-100/50 dark:bg-slate-950/40 hover:bg-slate-200/40 dark:hover:bg-slate-900/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Sun className={`h-5 w-5 ${theme === "light" ? "text-sky-500" : "text-slate-400"}`} />
              {theme === "light" && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-500 uppercase font-semibold">Active</span>}
            </div>
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Clean Frosted White</div>
            <p className="text-xs text-slate-500 mt-1">High-contrast day mode with frosted white glass and crisp borders</p>
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              theme === "dark"
                ? "border-sky-400 bg-sky-500/10 shadow-glow-cyan"
                : "border-slate-200/80 dark:border-white/10 bg-slate-100/50 dark:bg-slate-950/40 hover:bg-slate-200/40 dark:hover:bg-slate-900/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Moon className={`h-5 w-5 ${theme === "dark" ? "text-sky-400" : "text-slate-400"}`} />
              {theme === "dark" && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 uppercase font-semibold">Active</span>}
            </div>
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Cyber Industrial Dark</div>
            <p className="text-xs text-slate-500 mt-1">Low-glare cyber palette with deep slate tones and glowing neon accents</p>
          </button>
        </div>
      </div>

      {/* MQTT Broker Contract Card */}
      <div className="glass-card rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">MQTT Broker Specifications</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Eclipse Mosquitto 2.0 with Access Control Lists</p>
          </div>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase text-[10px] block">Telemetry Ingress Topic</span>
              <span className="text-sky-500 dark:text-sky-400 font-semibold">lansubx/&#123;device_key&#125;/telemetry</span>
            </div>
            <button
              onClick={() => handleCopy("lansubx/{device_key}/telemetry")}
              className="text-slate-400 hover:text-sky-500 dark:hover:text-white p-1"
            >
              {copiedTopic ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase text-[10px] block">Device Status & Last Will Topic</span>
              <span className="text-sky-500 dark:text-sky-400 font-semibold">lansubx/&#123;device_key&#125;/status</span>
            </div>
            <button
              onClick={() => handleCopy("lansubx/{device_key}/status")}
              className="text-slate-400 hover:text-sky-500 dark:hover:text-white p-1"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase text-[10px] block">Machine Remote Command Topic</span>
              <span className="text-sky-500 dark:text-sky-400 font-semibold">lansubx/&#123;device_key&#125;/command</span>
            </div>
            <button
              onClick={() => handleCopy("lansubx/{device_key}/command")}
              className="text-slate-400 hover:text-sky-500 dark:hover:text-white p-1"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Developer API Card */}
      <div className="glass-card rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Developer API & Interactive Docs</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">FastAPI OpenAPI Specification</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Access interactive Swagger documentation and test REST endpoints directly:
        </p>

        <a
          href="http://localhost:6500/docs"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-200/50 dark:bg-slate-800 hover:bg-sky-600 hover:text-white text-sky-500 dark:text-sky-400 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 transition-colors"
        >
          <span>OpenAPI Swagger UI (http://localhost:6500/docs)</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
