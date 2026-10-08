"use client";

import React, { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import Link from "next/navigation";
import { api } from "@/lib/api";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";
import {
  Cpu,
  CheckCircle2,
  XCircle,
  BellAlert,
  Network,
  ArrowUpRight,
  RefreshCw,
  Sliders,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";

export default function DashboardPage() {
  const { data: stats, error, mutate, isLoading } = useSWR("/dashboard", () => api.dashboard.getSummary(), {
    refreshInterval: 10000,
  });

  // Listen to real-time events over WebSocket and trigger instant SWR mutation
  const handleLiveMessage = useCallback(
    (msg: LiveMessage) => {
      if (msg.type === "alarm" || msg.type === "device_status" || msg.type === "telemetry") {
        mutate();
      }
    },
    [mutate]
  );

  useLiveSocket(handleLiveMessage);

  const handleAckAlarm = async (alarmId: number) => {
    try {
      await api.alarms.ack(alarmId);
      mutate();
    } catch (err: any) {
      alert(`Failed to acknowledge alarm: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Plant Operations Overview</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Unified status across Modbus, OPC UA, LoRa, and Direct MQTT networks
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => mutate()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
          <a
            href="/devices"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white shadow-md shadow-sky-600/30 transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Add Device</span>
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Devices */}
        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Total Devices</span>
            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-sky-400 transition-colors">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white font-mono">{stats?.total_devices ?? 0}</span>
            <span className="text-xs text-slate-400">registered</span>
          </div>
        </div>

        {/* Online Devices */}
        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-emerald-400">Online Machines</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-emerald-400 font-mono">{stats?.online_devices ?? 0}</span>
            <span className="text-xs text-slate-400">active now</span>
          </div>
        </div>

        {/* Offline Devices */}
        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Offline</span>
            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-slate-300 font-mono">{stats?.offline_devices ?? 0}</span>
            <span className="text-xs text-slate-400">inactive</span>
          </div>
        </div>

        {/* Active Alarms */}
        <div
          className={`p-5 rounded-xl border shadow-lg relative overflow-hidden transition-all ${
            (stats?.active_alarms ?? 0) > 0
              ? "bg-rose-950/30 border-rose-800/60 shadow-rose-950/20"
              : "bg-slate-900/70 border-slate-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-mono uppercase ${
                (stats?.active_alarms ?? 0) > 0 ? "text-rose-400" : "text-slate-400"
              }`}
            >
              Active Alarms
            </span>
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                (stats?.active_alarms ?? 0) > 0
                  ? "bg-rose-900/50 text-rose-400 border border-rose-700/50 animate-pulse"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span
              className={`text-3xl font-bold font-mono ${
                (stats?.active_alarms ?? 0) > 0 ? "text-rose-400" : "text-white"
              }`}
            >
              {stats?.active_alarms ?? 0}
            </span>
            <span className="text-xs text-slate-400">unresolved</span>
          </div>
        </div>

        {/* Gateways */}
        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Gateways</span>
            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-sky-400 transition-colors">
              <Network className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white font-mono">{stats?.total_gateways ?? 0}</span>
            <span className="text-xs text-slate-400">bridges</span>
          </div>
        </div>
      </div>

      {/* Active & Recent Alarms Panel */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-rose-950/60 border border-rose-800/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Recent Alarm Events</h2>
              <p className="text-xs text-slate-400">Real-time alerts triggered by threshold violations</p>
            </div>
          </div>
          <a
            href="/alarms"
            className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
          >
            <span>View All Alarms</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {stats?.recent_alarms && stats.recent_alarms.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800/80">
                <tr>
                  <th className="py-3 px-5">Severity</th>
                  <th className="py-3 px-5">Device</th>
                  <th className="py-3 px-5">Metric</th>
                  <th className="py-3 px-5">Recorded Value</th>
                  <th className="py-3 px-5">Threshold</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Opened At</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.recent_alarms.map((alarm: any) => {
                  const isCritical = alarm.severity === "critical";
                  return (
                    <tr key={alarm.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                            isCritical
                              ? "bg-rose-950 text-rose-400 border border-rose-800"
                              : "bg-amber-950 text-amber-400 border border-amber-800"
                          }`}
                        >
                          {alarm.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-medium text-white">
                        <a href={`/devices/${alarm.device_id}`} className="hover:text-sky-400 transition-colors">
                          {alarm.device_name}
                        </a>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-300">{alarm.metric}</td>
                      <td className="py-3.5 px-5 font-mono font-bold text-white">{alarm.value}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">{alarm.threshold}</td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                            alarm.state === "active"
                              ? "bg-rose-900/40 text-rose-300 border border-rose-700/40"
                              : alarm.state === "acknowledged"
                              ? "bg-amber-900/40 text-amber-300 border border-amber-700/40"
                              : "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40"
                          }`}
                        >
                          {alarm.state}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        {new Date(alarm.opened_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {alarm.state === "active" && (
                          <button
                            onClick={() => handleAckAlarm(alarm.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-medium rounded border border-slate-700 transition-colors"
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
          <div className="py-12 text-center text-slate-400 text-xs">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-white font-medium">All Systems Normal</p>
            <p className="text-slate-500 mt-1">No active alarm conditions detected across machinery.</p>
          </div>
        )}
      </div>
    </div>
  );
}
