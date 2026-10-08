"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Filter,
  Check,
  RefreshCw,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Alarms & Faults Console</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Real-time alert monitoring, incident acknowledgment, and automated fault resolution
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* State Filter Tabs */}
      <div className="flex rounded-lg bg-slate-900/80 p-1 border border-slate-800 w-fit">
        {[
          { id: "active", label: "Active Faults" },
          { id: "acknowledged", label: "Acknowledged" },
          { id: "resolved", label: "Resolved" },
          { id: "all", label: "All Incidents" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedState(tab.id)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              selectedState === tab.id
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alarms Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800/80">
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
            <tbody className="divide-y divide-slate-800/60">
              {alarms && alarms.length > 0 ? (
                alarms.map((alarm: any) => {
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
                      <td className="py-3.5 px-5 font-semibold text-white">
                        <a href={`/devices/${alarm.device_id}`} className="hover:text-sky-400">
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
                              ? "bg-rose-900/40 text-rose-300 border border-rose-700/40 animate-pulse"
                              : alarm.state === "acknowledged"
                              ? "bg-amber-900/40 text-amber-300 border border-amber-700/40"
                              : "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40"
                          }`}
                        >
                          {alarm.state}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 text-[11px]">
                        {new Date(alarm.opened_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 text-[11px]">
                        {alarm.closed_at ? new Date(alarm.closed_at).toLocaleString() : "-"}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {alarm.state === "active" && (
                            <button
                              onClick={() => handleAck(alarm.id)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-medium rounded border border-slate-700 transition-colors"
                            >
                              Ack
                            </button>
                          )}
                          {alarm.state !== "resolved" && (
                            <button
                              onClick={() => handleResolve(alarm.id)}
                              className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 text-[11px] font-medium rounded border border-emerald-800/60 transition-colors"
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
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-70" />
                    <p className="text-sm font-medium text-slate-400">No Alarms in '{selectedState}' state</p>
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
