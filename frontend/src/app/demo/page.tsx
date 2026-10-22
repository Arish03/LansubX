"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import RealtimeStreamChart, { StreamPoint } from "@/components/charts/RealtimeStreamChart";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";
import {
  Activity,
  ArrowLeft,
  Radio,
  Sliders,
  Zap,
  Flame,
  ShieldAlert,
  RotateCcw,
  Play,
  Pause,
  Layers,
  Terminal,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface TelemetryFrame {
  id: string;
  topic: string;
  deviceKey: string;
  values: Record<string, number>;
  ts: string;
}

export default function DemoPage() {
  const [streamSpeed, setStreamSpeed] = useState<number>(1);
  const [simScenario, setSimScenario] = useState<"nominal" | "overheating" | "high_vibration">("nominal");
  const [frames, setFrames] = useState<TelemetryFrame[]>([
    {
      id: "f-1",
      topic: "lansubx/CNC-SPINDLE-01/telemetry",
      deviceKey: "CNC-SPINDLE-01",
      values: { temperature: 64.2, pressure: 8.5, vibration: 0.38, motor_speed: 1450, power: 46.1 },
      ts: new Date().toISOString(),
    },
    {
      id: "f-2",
      topic: "lansubx/HYDRAULIC-PUMP-02/telemetry",
      deviceKey: "HYDRAULIC-PUMP-02",
      values: { temperature: 71.8, pressure: 12.4, vibration: 0.52, motor_speed: 1820, power: 62.4 },
      ts: new Date(Date.now() - 1500).toISOString(),
    },
  ]);

  const [simulatedAlert, setSimulatedAlert] = useState<string | null>(null);

  // Listen to WebSocket messages if connected
  const handleLiveMessage = useCallback((msg: LiveMessage) => {
    if (msg.type === "telemetry" && msg.values) {
      const newFrame: TelemetryFrame = {
        id: `f-${Date.now()}-${Math.random()}`,
        topic: `lansubx/${msg.device_key || "DEVICE"}/telemetry`,
        deviceKey: msg.device_key || `DEV-${msg.device_id || "NODE"}`,
        values: msg.values,
        ts: msg.ts || new Date().toISOString(),
      };
      setFrames((prev) => [newFrame, ...prev.slice(0, 15)]);
    }
  }, []);

  useLiveSocket(handleLiveMessage);

  // Scenario Simulator
  const injectScenario = (scenario: "nominal" | "overheating" | "high_vibration") => {
    setSimScenario(scenario);
    if (scenario === "overheating") {
      setSimulatedAlert("High Temperature Threshold (85°C) Exceeded on CNC-SPINDLE-01!");
      setTimeout(() => setSimulatedAlert(null), 6000);
    } else if (scenario === "high_vibration") {
      setSimulatedAlert("Excessive Vibration (1.4 mm/s) Detected on Motor Bearing!");
      setTimeout(() => setSimulatedAlert(null), 6000);
    } else {
      setSimulatedAlert(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/40 dark:border-slate-800/60">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <a
              href="/dashboard"
              className="inline-flex items-center space-x-1 text-xs font-mono text-slate-500 hover:text-sky-500 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Cockpit</span>
            </a>
            <span className="text-slate-400">&bull;</span>
            <a
              href="/"
              className="text-xs font-mono text-slate-500 hover:text-sky-500 dark:hover:text-white transition-colors"
            >
              Landing Page
            </a>
          </div>

          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Real-time Telemetry Data Stream Studio
            </h1>
            <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 beacon-live" />
              <span>LIVE STREAM</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Rolling WebSocket Feed &bull; 1 msgs/sec &bull; 30 pts buffer &bull; Sub-millisecond telemetry curve
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <a
            href="/devices"
            className="glass-card flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-200 hover:text-sky-500 transition-colors shadow-sm"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Connect Hardware</span>
          </a>
          <a
            href="/dashboard"
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-xs font-semibold text-white shadow-lg shadow-sky-600/25 transition-all"
          >
            <span>Supervisory Cockpit</span>
          </a>
        </div>
      </div>

      {/* Simulator Scenario Banner */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Interactive Telemetry Scenario Simulator
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Test dynamic telemetry curves and alarm rule triggers in real time
            </p>
          </div>
        </div>

        {/* Scenario Buttons */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={() => injectScenario("nominal")}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              simScenario === "nominal"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold shadow-sm"
                : "bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span>Nominal Operations</span>
          </button>
          <button
            onClick={() => injectScenario("overheating")}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              simScenario === "overheating"
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold shadow-sm"
                : "bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className="flex items-center space-x-1">
              <Flame className="h-3 w-3 text-rose-500" />
              <span>Inject Overheating</span>
            </span>
          </button>
          <button
            onClick={() => injectScenario("high_vibration")}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              simScenario === "high_vibration"
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold shadow-sm"
                : "bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span>Inject High Vibration</span>
          </button>
        </div>
      </div>

      {/* Simulated Alert Notification */}
      {simulatedAlert && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-500 text-xs font-mono flex items-center justify-between animate-bounce">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <span className="font-bold">{simulatedAlert}</span>
          </div>
          <span className="text-[10px] text-rose-400 uppercase tracking-widest font-semibold">
            Rule Triggered
          </span>
        </div>
      )}

      {/* Main Real-time Multi-Stream Line Chart */}
      <RealtimeStreamChart maxPoints={30} />

      {/* Lower Section: Telemetry Frame Inspector & Technical Telemetry Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Raw Frame Inspector (7 cols) */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/40 dark:border-slate-800/60">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Live Telemetry Ingestion Frames
                </h3>
              </div>
              <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                JSON STREAM
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mb-3">
              Standardized telemetry frames decoded from Modbus registers, OPC UA nodes & MQTT topics:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {frames.map((frame) => (
                <div
                  key={frame.id}
                  className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/70 border border-slate-200/60 dark:border-slate-800/80 font-mono text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sky-500 font-semibold">{frame.topic}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(frame.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto p-1.5 rounded bg-slate-200/50 dark:bg-slate-900/60">
                    {JSON.stringify({ values: frame.values }, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Protocol: MQTT v3.1.1 / WSS</span>
            <span className="text-emerald-500">Encrypted Transport</span>
          </div>
        </div>

        {/* Right: Telemetry Pipeline Topology (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-200/40 dark:border-slate-800/60">
            <Layers className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Streaming Engine Architecture
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 block">1. Field Telemetry Ingress</span>
              <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                MQTT clients publish metrics to <code className="text-sky-400">lansubx/&#123;key&#125;/telemetry</code>.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 block">2. Redis High-Speed Bus</span>
              <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                FastAPI worker publishes to owner channel <code className="text-violet-400">live:&#123;owner_id&#125;</code>.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 block">3. Reactive Client Hook</span>
              <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                Browser receives frames via WebSocket and appends to the rolling 30-point buffer.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 block">4. Debounced Rules Engine</span>
              <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                Threshold condition checks evaluate in memory; alarms auto-resolve when nominal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
