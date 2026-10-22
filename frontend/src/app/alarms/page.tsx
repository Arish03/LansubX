"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";
import {
  Bell,
  CircleCheck as CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Filter,
  Check,
  RefreshCw,
  Radio,
} from "lucide-react";

export default function AlarmsPage() {
  const [selectedState, setSelectedState] = useState<string>("active");

  const { data: alarms, mutate, isLoading } = useSWR(
    `/alarms?state=${selectedState}`,
    () => api.alarms.list({ state: selectedState === "all" ? undefined : selectedState }),
    { refreshInterval: 5000 }
  );

  const handleLiveMessage = useCallback(
    (msg: LiveMessage) => {
      if (msg.type === "alarm") {
        mutate();
      }
    },
    [mutate]
  );
  useLiveSocket(handleLiveMessage);

  const handleAck = async (id: number) => {
    try {
      await api.alarms.ack(id);
      mutate();
    } catch (err: any) {
      alert(`Failed to acknowledge alarm: ${err.message}`);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await api.alarms.resolve(id);
      mutate();
    } catch (err: any) {
      alert(`Failed to resolve alarm: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/40 dark:border-slate-800/60">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Alarms & Fault Incident Console
            </h1>
            <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 beacon-alarm" />
              <span>SAFETY MONITOR</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Real-time alert monitoring, incident acknowledgment, and automated fault resolution
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="glass-card flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-200 hover:text-sky-500 transition-colors self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Incidents</span>
        </button>
      </div>

      {/* State Filter Tabs */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950/60 p-1 border border-slate-200/80 dark:border-white/10 w-fit font-mono">
        {[
          { id: "active", label: "Active Faults" },
          { id: "acknowledged", label: "Acknowledged" },
          { id: "resolved", label: "Resolved" },
          { id: "all", label: "All Incidents" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedState(tab.id)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedState === tab.id
                ? "bg-sky-600 text-white shadow-sm font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alarms Table - Glass Card */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100/60 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200/60 dark:border-slate-800/80">
              <tr>
                <th className="py-3 px-5">Severity</th>
                <th className="py-3 px-5">Machine / Device</th>
                <th className="py-3 px-5">Metric</th>
                <th className="py-3 px-5">Value</th>
                <th className="py-3 px-5">Threshold</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Opened</th>
                <th className="py-3 px-5">Closed</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/60">
              {alarms && alarms.length > 0 ? (
                alarms.map((alarm: any) => {
                  const isCritical = alarm.severity === "critical";
                  return (
                    <tr key={alarm.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase font-semibold ${
                            isCritical
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                          }`}
                        >
                          {alarm.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white">
                        <a href={`/devices/${alarm.device_id}`} className="hover:text-sky-500 transition-colors">
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
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              : alarm.state === "acknowledged"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {alarm.state}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 text-[11px]">
                        {new Date(alarm.opened_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 text-[11px]">
                        {alarm.closed_at ? new Date(alarm.closed_at).toLocaleTimeString() : "-"}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {alarm.state === "active" && (
                            <button
                              onClick={() => handleAck(alarm.id)}
                              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              Ack
                            </button>
                          )}
                          {alarm.state !== "resolved" && (
                            <button
                              onClick={() => handleResolve(alarm.id)}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[11px] font-medium rounded-lg border border-emerald-500/30 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <CheckCircle className="h-9 w-9 text-emerald-500 mx-auto mb-2 opacity-80 beacon-live" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      No Alarms in '{selectedState}' state
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">All monitored conditions within nominal range.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
