"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Maximize2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";

export interface StreamPoint {
  ts: string;
  time: string;
  rawTs: number;
  [metric: string]: any;
}

const AVAILABLE_METRICS = [
  { key: "temperature", label: "Temperature", unit: "°C", color: "#00f0ff", stroke: "#00f0ff", grad: "gradTemp" },
  { key: "pressure", label: "Pressure", unit: "bar", color: "#10b981", stroke: "#10b981", grad: "gradPres" },
  { key: "vibration", label: "Vibration", unit: "mm/s", color: "#a855f7", stroke: "#a855f7", grad: "gradVib" },
  { key: "motor_speed", label: "Motor RPM", unit: "RPM", color: "#f59e0b", stroke: "#f59e0b", grad: "gradRpm" },
  { key: "power", label: "Power Load", unit: "kW", color: "#f43f5e", stroke: "#f43f5e", grad: "gradPwr" },
];

interface RealtimeStreamChartProps {
  initialData?: StreamPoint[];
  maxPoints?: number;
}

export default function RealtimeStreamChart({
  initialData = [],
  maxPoints = 30,
}: RealtimeStreamChartProps) {
  const [data, setData] = useState<StreamPoint[]>(() => {
    if (initialData.length > 0) return initialData;
    // Generate an initial graceful warm-up buffer if starting cold
    const now = Date.now();
    const seed: StreamPoint[] = [];
    for (let i = 20; i >= 0; i--) {
      const t = new Date(now - i * 2000);
      seed.push({
        ts: t.toISOString(),
        time: t.toLocaleTimeString(),
        rawTs: t.getTime(),
        temperature: Number((62 + Math.sin(i / 2) * 5 + (Math.random() * 2 - 1)).toFixed(1)),
        pressure: Number((8.4 + Math.cos(i / 3) * 0.8 + (Math.random() * 0.2 - 0.1)).toFixed(2)),
        vibration: Number((0.35 + Math.sin(i / 4) * 0.15 + (Math.random() * 0.05)).toFixed(2)),
        motor_speed: Math.round(1420 + Math.sin(i) * 60 + Math.random() * 20),
        power: Number((45.2 + Math.cos(i / 2) * 4 + Math.random() * 1.5).toFixed(1)),
      });
    }
    return seed;
  });

  const [activeMetric, setActiveMetric] = useState<string>("temperature");
  const [isPaused, setIsPaused] = useState(false);
  const [showAllLines, setShowAllLines] = useState(false);
  const [rateCounter, setRateCounter] = useState(0);
  const [eventsPerSec, setEventsPerSec] = useState(0);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const countInWindowRef = useRef(0);

  // Monitor points-per-second rate
  useEffect(() => {
    const timer = setInterval(() => {
      setEventsPerSec(countInWindowRef.current);
      countInWindowRef.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle incoming live WebSocket telemetry
  const handleLiveMessage = useCallback(
    (msg: LiveMessage) => {
      if (isPausedRef.current) return;

      if (msg.type === "telemetry" && msg.values) {
        countInWindowRef.current += 1;
        setRateCounter((prev) => prev + 1);

        const now = new Date(msg.ts || Date.now());
        const newPoint: StreamPoint = {
          ts: now.toISOString(),
          time: now.toLocaleTimeString(),
          rawTs: now.getTime(),
          ...msg.values,
        };

        setData((prev) => {
          const next = [...prev, newPoint];
          return next.slice(-maxPoints);
        });
      }
    },
    [maxPoints]
  );

  useLiveSocket(handleLiveMessage);

  // Fallback simulator interval so UI streams even in standalone demo mode
  useEffect(() => {
    const simInterval = setInterval(() => {
      if (isPausedRef.current) return;
      const now = new Date();
      setData((prev) => {
        const last = prev[prev.length - 1] || {
          temperature: 65,
          pressure: 8.5,
          vibration: 0.4,
          motor_speed: 1450,
          power: 46,
        };

        const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

        const nextPoint: StreamPoint = {
          ts: now.toISOString(),
          time: now.toLocaleTimeString(),
          rawTs: now.getTime(),
          temperature: Number(clamp(last.temperature + (Math.random() * 2.4 - 1.15), 45, 95).toFixed(1)),
          pressure: Number(clamp(last.pressure + (Math.random() * 0.4 - 0.2), 4, 15).toFixed(2)),
          vibration: Number(clamp(last.vibration + (Math.random() * 0.08 - 0.038), 0.1, 1.8).toFixed(2)),
          motor_speed: Math.round(clamp(last.motor_speed + (Math.random() * 40 - 20), 1000, 2200)),
          power: Number(clamp(last.power + (Math.random() * 1.8 - 0.88), 20, 80).toFixed(1)),
        };

        countInWindowRef.current += 1;
        return [...prev.slice(-(maxPoints - 1)), nextPoint];
      });
    }, 2500);

    return () => clearInterval(simInterval);
  }, [maxPoints]);

  const currentMetricConfig = useMemo(() => {
    return AVAILABLE_METRICS.find((m) => m.key === activeMetric) || AVAILABLE_METRICS[0];
  }, [activeMetric]);

  // Compute live statistics for current metric
  const stats = useMemo(() => {
    const vals = data
      .map((d) => d[activeMetric])
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    if (vals.length === 0) return { current: 0, min: 0, max: 0, avg: 0 };
    const current = vals[vals.length - 1];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));

    return { current, min, max, avg };
  }, [data, activeMetric]);

  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
      {/* Background Subtle Cyber Glow */}
      <div className="absolute top-0 right-1/4 w-80 h-36 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Activity className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
                  Real-time Telemetry Data Stream
                </h3>
                <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 beacon-live" />
                  <span>{isPaused ? "PAUSED" : "LIVE STREAM"}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Rolling WebSocket Feed &bull; {eventsPerSec || 1} msgs/sec &bull; {data.length} pts buffer
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar & Metric Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              isPaused
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                : "bg-slate-800/40 text-slate-300 border-slate-700/60 hover:bg-slate-800/80"
            }`}
            title={isPaused ? "Resume Stream" : "Pause Stream"}
          >
            {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          {/* Clear Buffer */}
          <button
            onClick={() => setData([])}
            className="p-1.5 rounded-lg bg-slate-800/40 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
            title="Reset Buffer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Multi-line toggle */}
          <button
            onClick={() => setShowAllLines(!showAllLines)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              showAllLines
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                : "bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{showAllLines ? "Combined Mode" : "Single Metric"}</span>
          </button>
        </div>
      </div>

      {/* Metric Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-2 border-b border-slate-200/50 dark:border-slate-800/80">
        {AVAILABLE_METRICS.map((m) => {
          const isActive = activeMetric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => {
                setActiveMetric(m.key);
                if (showAllLines) setShowAllLines(false);
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                isActive
                  ? "bg-slate-900 dark:bg-slate-800 text-white shadow-md border"
                  : "bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50"
              }`}
              style={{
                borderColor: isActive ? m.color : "transparent",
                boxShadow: isActive ? `0 0 16px -4px ${m.color}66` : undefined,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: m.color, boxShadow: `0 0 8px ${m.color}` }}
              />
              <span>{m.label}</span>
              <span className="text-[10px] opacity-70">({m.unit})</span>
            </button>
          );
        })}
      </div>

      {/* Live Statistics Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 block">
            Latest Telemetry
          </span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span
              className="text-xl font-bold font-mono tracking-tight"
              style={{ color: currentMetricConfig.color }}
            >
              {stats.current}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {currentMetricConfig.unit}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 block">
            Average (Window)
          </span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-200">
              {stats.avg}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {currentMetricConfig.unit}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 block">
            Peak (Max)
          </span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-rose-500">
              {stats.max}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {currentMetricConfig.unit}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 block">
            Trough (Min)
          </span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-emerald-500">
              {stats.min}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {currentMetricConfig.unit}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas with Glow Filters */}
      <div className="h-72 w-full pt-1">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center font-mono text-xs text-slate-400">
            Waiting for live telemetry stream packet...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                {/* Neon Area Gradients */}
                <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradPres" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradVib" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradRpm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradPwr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>

                {/* SVG Glow Filter */}
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />

              <XAxis
                dataKey="time"
                stroke="rgba(148, 163, 184, 0.5)"
                tick={{ fontSize: 10, fill: "rgba(148, 163, 184, 0.7)" }}
                tickLine={false}
              />

              <YAxis
                stroke="rgba(148, 163, 184, 0.5)"
                tick={{ fontSize: 10, fill: "rgba(148, 163, 184, 0.7)" }}
                tickLine={false}
                domain={["auto", "auto"]}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="glass-tooltip p-3 shadow-2xl">
                        <p className="text-[10px] font-mono text-slate-400 mb-1">{label}</p>
                        <div className="space-y-1">
                          {payload.map((item: any, idx: number) => {
                            const metricMeta = AVAILABLE_METRICS.find((m) => m.key === item.dataKey);
                            return (
                              <div key={idx} className="flex items-center space-x-2 text-xs font-mono">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-slate-300 font-medium">
                                  {metricMeta ? metricMeta.label : item.dataKey}:
                                </span>
                                <span className="font-bold text-white">
                                  {item.value} {metricMeta?.unit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {showAllLines ? (
                // Combined multi-metric stream mode
                AVAILABLE_METRICS.map((m) => (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.stroke}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))
              ) : (
                // Focused single metric with rich gradient area and active endpoint
                <Area
                  type="monotone"
                  dataKey={activeMetric}
                  name={currentMetricConfig.label}
                  stroke={currentMetricConfig.stroke}
                  strokeWidth={2.5}
                  fill={`url(#${currentMetricConfig.grad})`}
                  isAnimationActive={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
