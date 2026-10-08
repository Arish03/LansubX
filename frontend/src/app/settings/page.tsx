"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Settings, User, Shield, Server, ExternalLink, Check, Copy, Radio } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [copiedTopic, setCopiedTopic] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTopic(true);
    setTimeout(() => setCopiedTopic(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Platform Settings & Security</h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Account credentials, role permissions, and MQTT infrastructure configuration
        </p>
      </div>

      {/* Account Info Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Current Account</h2>
            <p className="text-xs text-slate-400 font-mono">Authentication & Role-Based Access Control</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-2">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 uppercase text-[10px] block">Email Address</span>
            <span className="text-white font-medium">{user?.email}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 uppercase text-[10px] block">Assigned Role</span>
            <span className="text-sky-400 font-bold uppercase">{user?.role}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 uppercase text-[10px] block">User ID</span>
            <span className="text-slate-300">#{user?.id}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 uppercase text-[10px] block">Account Created</span>
            <span className="text-slate-300">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* MQTT Broker Contract Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">MQTT Broker Specifications</h2>
            <p className="text-xs text-slate-400 font-mono">Eclipse Mosquitto 2.0 with Access Control Lists</p>
          </div>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase text-[10px] block">Telemetry Ingress Topic</span>
              <span className="text-sky-400 font-semibold">lansubx/&#123;device_key&#125;/telemetry</span>
            </div>
            <button
              onClick={() => handleCopy("lansubx/{device_key}/telemetry")}
              className="text-slate-400 hover:text-white"
            >
              {copiedTopic ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase text-[10px] block">Device Status & Last Will Topic</span>
              <span className="text-sky-400 font-semibold">lansubx/&#123;device_key&#125;/status</span>
            </div>
            <button
              onClick={() => handleCopy("lansubx/{device_key}/status")}
              className="text-slate-400 hover:text-white"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase text-[10px] block">Machine Remote Command Topic</span>
              <span className="text-sky-400 font-semibold">lansubx/&#123;device_key&#125;/command</span>
            </div>
            <button
              onClick={() => handleCopy("lansubx/{device_key}/command")}
              className="text-slate-400 hover:text-white"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Developer API Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Developer API & Interactive Docs</h2>
            <p className="text-xs text-slate-400 font-mono">FastAPI OpenAPI Specification</p>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Access interactive Swagger documentation and test REST endpoints directly:
        </p>

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-mono rounded-lg border border-slate-700 transition-colors"
        >
          <span>OpenAPI Swagger UI (http://localhost:8000/docs)</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
