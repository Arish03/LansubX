"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ShieldCheck, AlertTriangle } from "lucide-react";

interface FleetDistributionDonutProps {
  online: number;
  offline: number;
  alarms: number;
}

export default function FleetDistributionDonut({
  online = 0,
  offline = 0,
  alarms = 0,
}: FleetDistributionDonutProps) {
  const total = online + offline;
  const onlinePercent = total > 0 ? Math.round((online / total) * 100) : 100;

  const chartData = useMemo(() => {
    // If no devices yet, provide a baseline slice so chart renders cleanly
    if (total === 0) {
      return [{ name: "Standby", value: 1, color: "#475569" }];
    }

    const items = [
      { name: "Online Normal", value: Math.max(0, online - alarms), color: "#10b981" },
      { name: "Online With Alarms", value: alarms, color: "#f43f5e" },
      { name: "Offline", value: offline, color: "#64748b" },
    ];
    return items.filter((i) => i.value > 0);
  }, [online, offline, alarms, total]);

  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            Fleet Health Status
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Machine availability & alarm conditions
          </p>
        </div>
        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
        </div>
      </div>

      {/* Donut Chart with Center Readout */}
      <div className="relative h-48 w-full flex items-center justify-center my-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0];
                  const pct = total > 0 ? Math.round(((data.value as number) / total) * 100) : 100;
                  return (
                    <div className="glass-tooltip p-2.5 shadow-xl text-xs font-mono">
                      <div className="flex items-center space-x-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: data.payload.color }}
                        />
                        <span className="text-slate-200">{data.name}:</span>
                        <span className="font-bold text-white">{data.value}</span>
                        <span className="text-slate-400">({pct}%)</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={4}
              dataKey="value"
              stroke="transparent"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{
                    filter: `drop-shadow(0 0 6px ${entry.color}40)`,
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Frosted Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
            {onlinePercent}%
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-semibold">
            {alarms > 0 ? "ATTENTION" : "OPERATIONAL"}
          </span>
        </div>
      </div>

      {/* Bottom Breakdown Legends */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/80 text-center">
        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block font-medium">Online</span>
          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{online}</span>
        </div>
        <div className="p-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
          <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 block font-medium">Offline</span>
          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{offline}</span>
        </div>
        <div className={`p-1.5 rounded-lg border ${alarms > 0 ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"}`}>
          <span className={`text-[10px] font-mono block font-medium ${alarms > 0 ? "text-rose-500" : "text-slate-500"}`}>Alarms</span>
          <span className={`text-sm font-bold font-mono ${alarms > 0 ? "text-rose-500" : "text-slate-900 dark:text-white"}`}>{alarms}</span>
        </div>
      </div>
    </div>
  );
}
