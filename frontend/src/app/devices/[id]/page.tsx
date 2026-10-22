"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Cpu,
  ArrowLeft,
  Activity,
  Send,
  Clock,
  SlidersHorizontal as Sliders,
  CircleCheck as CheckCircle2,
  CircleX as XCircle,
  CircleAlert as AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Zap,
} from "lucide-react";

const TIME_RANGES = [
  { label: "15 min", value: "15m", seconds: 15 * 60 },
  { label: "1 hour", value: "1h", seconds: 60 * 60 },
  { label: "24 hours", value: "24h", seconds: 24 * 60 * 60 },
  { label: "7 days", value: "7d", seconds: 7 * 24 * 60 * 60 },
];

export default function DeviceDetailPage() {
  const params = useParams();
  const deviceId = Number(params?.id);

  const { data: device, mutate: mutateDevice } = useSWR(
    deviceId ? `/devices/${deviceId}` : null,
    () => api.devices.get(deviceId)
  );

  const { data: metricsList, mutate: mutateMetrics } = useSWR(
    deviceId ? `/devices/${deviceId}/metrics` : null,
    () => api.telemetry.getMetrics(deviceId)
  );

  const { data: latestMap, mutate: mutateLatest } = useSWR(
    deviceId ? `/devices/${deviceId}/telemetry/latest` : null,
    () => api.telemetry.getLatest(deviceId)
  );

  const { data: commands, mutate: mutateCommands } = useSWR(
    deviceId ? `/devices/${deviceId}/commands` : null,
    () => api.commands.list(deviceId)
  );

  // Chart controls
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<string>("1h");
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // Command console state
  const [commandAction, setCommandAction] = useState("set_speed");
  const [commandParams, setCommandParams] = useState('{"target_rpm": 1200}');
  const [sendingCommand, setSendingCommand] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [copiedKey, setCopiedKey] = useState(false);

  // Set default selected metric when metricsList loads
  useEffect(() => {
    if (metricsList && metricsList.length > 0 && !selectedMetric) {
      setSelectedMetric(metricsList[0]);
    }
  }, [metricsList, selectedMetric]);

  // Fetch telemetry history for selected metric and range
  const fetchHistory = useCallback(async () => {
    if (!deviceId || !selectedMetric) return;
    setLoadingChart(true);
    try {
      const rangeObj = TIME_RANGES.find((r) => r.value === selectedRange);
      const seconds = rangeObj ? rangeObj.seconds : 3600;
      const startIso = new Date(Date.now() - seconds * 1000).toISOString();

      const data = await api.telemetry.getHistory(deviceId, {
        metric: selectedMetric,
        start: startIso,
        limit: 500,
      });

      const formatted = data.map((d: any) => ({
        ts: d.ts,
        time: new Date(d.ts).toLocaleTimeString(),
        value: d.value,
      }));
      setChartData(formatted);
    } catch (err) {
      console.error("Failed to load telemetry history:", err);
    } finally {
      setLoadingChart(false);
    }
  }, [deviceId, selectedMetric, selectedRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Real-time WebSocket event handler
  const handleLiveMessage = useCallback(
    (msg: LiveMessage) => {
      if (msg.device_id === deviceId) {
        if (msg.type === "telemetry") {
          mutateLatest();
          mutateMetrics();
          // If the message has value for currently selected metric, append smoothly to chart
          if (selectedMetric && msg.values && msg.values[selectedMetric] !== undefined) {
            const newVal = msg.values[selectedMetric];
            const newTs = msg.ts || new Date().toISOString();
            setChartData((prev: any[]) => [
              ...prev.slice(-300), // Keep rolling window
              {
                ts: newTs,
                time: new Date(newTs).toLocaleTimeString(),
                value: newVal,
              },
            ]);
          }
        } else if (msg.type === "device_status") {
          mutateDevice();
        } else if (msg.type === "command_result") {
          mutateCommands();
          setCommandFeedback({
            ok: msg.status === "acked",
            msg: `Command #${msg.command_id} became '${msg.status}'`,
          });
          setTimeout(() => setCommandFeedback(null), 5000);
        }
      }
    },
    [deviceId, selectedMetric, mutateLatest, mutateMetrics, mutateDevice, mutateCommands]
  );

  useLiveSocket(handleLiveMessage);

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingCommand(true);
    setCommandFeedback(null);
    try {
      let parsedParams = {};
      if (commandParams.trim()) {
        parsedParams = JSON.parse(commandParams);
      }
      await api.commands.send(deviceId, {
        action: commandAction,
        params: parsedParams,
      });
      mutateCommands();
      setCommandFeedback({ ok: true, msg: "Command dispatched over MQTT (awaiting acknowledgment...)" });
    } catch (err: any) {
      setCommandFeedback({ ok: false, msg: `Command dispatch failed: ${err.message}` });
    } finally {
      setSendingCommand(false);
    }
  };

  const handleCopyKey = () => {
    if (device?.device_key) {
      navigator.clipboard.writeText(device.device_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (!device) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="glass-card p-6 rounded-2xl flex items-center space-x-3 text-slate-400 font-mono text-xs">
          <div className="h-5 w-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span>Interrogating Device Parameters...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div>
        <a
          href="/devices"
          className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-500 hover:text-sky-500 dark:hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Device Fleet</span>
        </a>

        <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-md">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{device.name}</h1>
                <div className="flex items-center space-x-1.5">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      device.is_online ? "bg-emerald-400 beacon-live" : "bg-slate-500"
                    }`}
                  />
                  <span
                    className={`text-xs font-mono font-semibold ${
                      device.is_online ? "text-emerald-500" : "text-slate-500"
                    }`}
                  >
                    {device.is_online ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span className="flex items-center space-x-1">
                  <span>Key:</span>
                  <span className="text-sky-500 font-semibold">{device.device_key}</span>
                  <button onClick={handleCopyKey} className="text-slate-400 hover:text-sky-400 ml-1">
                    {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </span>
                <span>&bull;</span>
                <span className="uppercase px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800/60 text-[10px] text-slate-700 dark:text-slate-300 font-semibold border border-slate-300/40 dark:border-white/10">
                  {device.kind}
                </span>
                {device.gateway_id && (
                  <>
                    <span>&bull;</span>
                    <span>Gateway #{device.gateway_id}</span>
                  </>
                )}
                <span>&bull;</span>
                <span className="text-[11px] text-slate-400">
                  Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleTimeString() : "Never"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                mutateLatest();
                fetchHistory();
              }}
              className="glass-card flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-200 hover:text-sky-400 transition-colors shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Poll Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Metric Cards Grid */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center space-x-1.5">
          <Activity className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
          <span>Live Sensor Telemetry Array</span>
        </h2>

        {latestMap && Object.keys(latestMap).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(latestMap).map(([metric, data]: [string, any]) => {
              const isSelected = selectedMetric === metric;
              return (
                <div
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all glass-card ${
                    isSelected
                      ? "border-sky-500 shadow-glow-cyan ring-1 ring-sky-500/50 bg-sky-500/10"
                      : "hover:border-slate-400 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate uppercase font-semibold">
                    {metric}
                  </span>
                  <div className="mt-2 flex items-baseline space-x-1">
                    <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                      {data.value}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                    {new Date(data.ts).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl glass-card text-center text-xs font-mono text-slate-500">
            No telemetry received yet. Publish data to topic{" "}
            <code className="text-sky-400 font-mono">lansubx/{device.device_key}/telemetry</code>.
          </div>
        )}
      </div>

      {/* Main Chart Section */}
      <div className="glass-card rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Time-Series Telemetry Stream
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Active Metric: <span className="text-sky-400 font-bold">{selectedMetric || "None"}</span>
              </p>
            </div>
            {metricsList && metricsList.length > 0 && (
              <select
                value={selectedMetric}
                onChange={(e: any) => setSelectedMetric(e.target.value)}
                className="glass-input rounded-xl text-xs text-sky-500 dark:text-sky-400 py-1.5 px-3 font-mono focus:outline-none"
              >
                {metricsList.map((m: string) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950/60 p-1 border border-slate-200/80 dark:border-white/10 self-start sm:self-auto">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setSelectedRange(r.value)}
                className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                  selectedRange === r.value
                    ? "bg-sky-600 text-white font-semibold shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-72 w-full pt-2">
          {loadingChart ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
              Interrogating time-series points...
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: "#64748b" }} domain={["auto", "auto"]} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="glass-tooltip p-3 shadow-xl font-mono text-xs">
                          <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                          <p className="font-bold text-sky-400">
                            {selectedMetric}: {payload[0].value}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00f0ff"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#metricGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
              No historical data recorded for metric '{selectedMetric}' in this window.
            </div>
          )}
        </div>
      </div>

      {/* Machine Control Console & Command Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Remote Command Dispatch Box */}
        <div className="glass-card rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Machine Command Console</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Bi-directional remote control via MQTT topic
              </p>
            </div>
          </div>

          {commandFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center space-x-2 ${
                commandFeedback.ok
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-500"
              }`}
            >
              {commandFeedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{commandFeedback.msg}</span>
            </div>
          )}

          <form onSubmit={handleSendCommand} className="space-y-3 font-mono text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Action Name</label>
              <input
                type="text"
                required
                value={commandAction}
                onChange={(e: any) => setCommandAction(e.target.value)}
                placeholder="e.g. set_speed, set_output, reboot"
                className="w-full px-3 py-2.5 glass-input rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">JSON Parameters (optional)</label>
              <textarea
                rows={3}
                value={commandParams}
                onChange={(e: any) => setCommandParams(e.target.value)}
                placeholder='{"target_rpm": 1200}'
                className="w-full px-3 py-2.5 glass-input rounded-xl focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={sendingCommand}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:opacity-50 text-white font-medium rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/30 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{sendingCommand ? "Dispatching..." : "Send Command"}</span>
            </button>
          </form>
        </div>

        {/* Command Audit Log */}
        <div className="glass-card rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center space-x-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Commands History</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Track sent, acked, and failed requests
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-64 divide-y divide-slate-200/40 dark:divide-slate-800/60 font-mono">
            {commands && commands.length > 0 ? (
              commands.map((cmd: any) => (
                <div key={cmd.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-900 dark:text-white font-semibold">
                      #{cmd.id} &bull; {cmd.payload?.action}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {new Date(cmd.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold ${
                      cmd.status === "acked"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                        : cmd.status === "failed"
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse"
                    }`}
                  >
                    {cmd.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                No commands dispatched yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
