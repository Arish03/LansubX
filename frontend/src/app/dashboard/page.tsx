"use client";

import React, { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";
import RealtimeStreamChart from "@/components/charts/RealtimeStreamChart";
import FleetDistributionDonut from "@/components/charts/FleetDistributionDonut";
import ProtocolDistributionDonut from "@/components/charts/ProtocolDistributionDonut";
import {
  Cpu,
  CircleCheck as CheckCircle2,
  CircleX as XCircle,
  Network,
  ArrowUpRight,
  RefreshCw,
  CirclePlus as PlusCircle,
  ShieldAlert,
  Radio,
  Zap,
  Activity,
  Layers,
} from "lucide-react";

interface RecentLiveEvent {
  id: string;
  deviceKey: string;
  metric: string;
  value: number;
  time: string;
}

export default function DashboardPage() {
  const { data: stats, mutate: mutateStats } = useSWR("/dashboard", () => api.dashboard.getSummary(), {
    refreshInterval: 8000,
  });

  const { data: devices, mutate: mutateDevices } = useSWR("/devices", () => api.devices.list());

  const [liveEvents, setLiveEvents] = useState<RecentLiveEvent[]>([
    { id: "e1", deviceKey: "MODBUS-PUMP-01", metric: "motor_speed", value: 1450, time: "Just now" },
    { id: "e2", deviceKey: "ESP32-NODE-04", metric: "temperature", value: 68.2, time: "Just now" },
    { id: "e3", deviceKey: "OPCUA-RIG-02", metric: "pressure", value: 9.15, time: "Just now" },
  ]);

  // Listen to real-time events over WebSocket
  const handleLiveMessage = useCallback(
    (msg: LiveMessage) => {
      if (msg.type === "alarm" || msg.type === "device_status") {
        mutateStats();
        mutateDevices();
      }

      if (msg.type === "telemetry" && msg.values) {
        const firstMetricKey = Object.keys(msg.values)[0];
        if (firstMetricKey) {
          const newEvent: RecentLiveEvent = {
            id: `${Date.now()}-${Math.random()}`,
            deviceKey: msg.device_key || `DEV-${msg.device_id || "LIVE"}`,
            metric: firstMetricKey,
            value: msg.values[firstMetricKey],
            time: new Date(msg.ts || Date.now()).toLocaleTimeString(),
          };
          setLiveEvents((prev) => [newEvent, ...prev.slice(0, 6)]);
        }
      }
    },
    [mutateStats, mutateDevices]
  );

  useLiveSocket(handleLiveMessage);

  const handleAckAlarm = async (alarmId: number) => {
    try {
      await api.alarms.ack(alarmId);
      mutateStats();
    } catch (err: any) {
      alert(`Failed to acknowledge alarm: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Cockpit Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200/40 dark:border-slate-800/60">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Industrial Plant Telemetry Cockpit
            </h1>
            <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 beacon-live" />
              <span>LIVE SUITE</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Unified supervisory monitoring across Modbus TCP, OPC UA, LoRaWAN, and Direct MQTT pipelines
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              mutateStats();
              mutateDevices();
            }}
            className="glass-card flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-200 hover:text-sky-500 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync State</span>
          </button>
          <a
            href="/devices"
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-xs font-semibold text-white shadow-lg shadow-sky-600/25 transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Register Machine</span>
          </a>
        </div>
      </div>

      {/* KPI Cards Tier - Frosted Glass with Glowing Orbs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Devices */}
        <div className="glass-kpi rounded-2xl p-5 relative group">
          <div className="glass-glow-cyan" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
              Total Machines
            </span>
            <div className="h-8 w-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats?.total_devices ?? (devices ? devices.length : 0)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">registered</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-sky-600 dark:text-sky-400 flex items-center space-x-1">
            <Activity className="h-3 w-3" />
            <span>Industrial fleet</span>
          </div>
        </div>

        {/* Online Devices */}
        <div className="glass-kpi rounded-2xl p-5 relative group">
          <div className="glass-glow-emerald" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider">
              Online Active
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-4 w-4 beacon-live" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-500">
              {stats?.online_devices ?? 0}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">operational</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
            <Zap className="h-3 w-3" />
            <span>Telemetring real-time</span>
          </div>
        </div>

        {/* Offline Devices */}
        <div className="glass-kpi rounded-2xl p-5 relative group">
          <div className="glass-glow-cyan" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
              Offline Nodes
            </span>
            <div className="h-8 w-8 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-slate-700 dark:text-slate-300">
              {stats?.offline_devices ?? 0}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">standby</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center space-x-1">
            <span>&bull;</span>
            <span>No heartbeat in 30s</span>
          </div>
        </div>

        {/* Active Alarms */}
        <div
          className={`glass-kpi rounded-2xl p-5 relative group ${
            (stats?.active_alarms ?? 0) > 0 ? "border-rose-500/40" : ""
          }`}
        >
          {(stats?.active_alarms ?? 0) > 0 && <div className="glass-glow-rose" />}
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-mono uppercase font-semibold tracking-wider ${
                (stats?.active_alarms ?? 0) > 0 ? "text-rose-500 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Active Alarms
            </span>
            <div
              className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                (stats?.active_alarms ?? 0) > 0
                  ? "bg-rose-500/20 border border-rose-500/50 text-rose-500 beacon-alarm"
                  : "bg-slate-500/10 border border-slate-500/20 text-slate-400"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span
              className={`text-3xl font-extrabold font-mono ${
                (stats?.active_alarms ?? 0) > 0 ? "text-rose-500" : "text-slate-900 dark:text-white"
              }`}
            >
              {stats?.active_alarms ?? 0}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">unresolved</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-rose-600 dark:text-rose-400 flex items-center space-x-1">
            <span>{(stats?.active_alarms ?? 0) > 0 ? "Requires Acknowledgment" : "Nominal limits"}</span>
          </div>
        </div>

        {/* Gateways Bridges */}
        <div className="glass-kpi rounded-2xl p-5 relative group">
          <div className="glass-glow-purple" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
              Bridges & Gateways
            </span>
            <div className="h-8 w-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Network className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats?.total_gateways ?? 0}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">connected</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-violet-600 dark:text-violet-400 flex items-center space-x-1">
            <Layers className="h-3 w-3" />
            <span>Multiplexed channels</span>
          </div>
        </div>
      </div>

      {/* Main Visual Tier: Realtime Stream Line Graph + Donut Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Real-time Multi-Stream Line Graph (8 cols) */}
        <div className="lg:col-span-8">
          <RealtimeStreamChart />
        </div>

        {/* Right: Dual Donut / Pie Charts (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <FleetDistributionDonut
            online={stats?.online_devices ?? 0}
            offline={stats?.offline_devices ?? 0}
            alarms={stats?.active_alarms ?? 0}
          />
          <ProtocolDistributionDonut
            devices={devices}
            totalGateways={stats?.total_gateways ?? 0}
          />
        </div>
      </div>

      {/* Lower Tier: Alarms Feed & Live Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Alarms Table (8 cols) */}
        <div className="lg:col-span-8 glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Recent Alarms & Fault Conditions
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Automated threshold breaches evaluated by the rules engine
                </p>
              </div>
            </div>
            <a
              href="/alarms"
              className="flex items-center space-x-1 text-xs text-sky-500 hover:text-sky-400 font-mono font-medium transition-colors"
            >
              <span>View All Alarms</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {stats?.recent_alarms && stats.recent_alarms.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100/60 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200/60 dark:border-slate-800/80">
                  <tr>
                    <th className="py-3 px-5">Severity</th>
                    <th className="py-3 px-5">Machine</th>
                    <th className="py-3 px-5">Metric</th>
                    <th className="py-3 px-5">Value</th>
                    <th className="py-3 px-5">Limit</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Opened</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/60">
                  {stats.recent_alarms.map((alarm: any) => {
                    const isCritical = alarm.severity === "critical";
                    return (
                      <tr key={alarm.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${
                              isCritical
                                ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                                : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                            }`}
                          >
                            {alarm.severity}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">
                          <a href={`/devices/${alarm.device_id}`} className="hover:text-sky-400 transition-colors">
                            {alarm.device_name}
                          </a>
                        </td>
                        <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">{alarm.metric}</td>
                        <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{alarm.value}</td>
                        <td className="py-3.5 px-5 text-slate-500">{alarm.threshold}</td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] capitalize ${
                              alarm.state === "active"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {alarm.state}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-500">
                          {new Date(alarm.opened_at).toLocaleTimeString()}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {alarm.state === "active" && (
                            <button
                              onClick={() => handleAckAlarm(alarm.id)}
                              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-all"
                            >
                              Acknowledge
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2.5 opacity-90 beacon-live" />
              <p className="text-slate-900 dark:text-white font-semibold text-sm">All Operational Systems Normal</p>
              <p className="text-slate-500 dark:text-slate-400 mt-1 font-mono">
                No active threshold violations across registered machinery.
              </p>
            </div>
          )}
        </div>

        {/* Right: Realtime Event Stream Ticker (4 cols) */}
        <div className="lg:col-span-4 glass-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/40 dark:border-slate-800/60">
              <div className="flex items-center space-x-2">
                <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Live Ingestion Ticker
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                WS ACTIVE
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mb-3">
              Incoming telemetry frames arriving via MQTT & Redis pub/sub
            </p>

            <div className="space-y-2">
              {liveEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center space-x-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <div>
                      <span className="text-slate-900 dark:text-white font-semibold block text-[11px]">
                        {evt.deviceKey}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                        {evt.metric}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sky-500 dark:text-sky-400 block">{evt.value}</span>
                    <span className="text-[9px] text-slate-400">{evt.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/60 text-center">
            <span className="text-[10px] font-mono text-slate-500">
              Encrypted Modbus TCP / OPC UA / LoRa telemetry pipeline
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
