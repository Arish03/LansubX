"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Network, Radio, Layers } from "lucide-react";

interface ProtocolDistributionDonutProps {
  devices?: any[];
  totalGateways?: number;
}

const PROTOCOL_CONFIG: Record<string, { label: string; color: string }> = {
  modbus: { label: "Modbus TCP", color: "#0284c7" },
  opcua: { label: "OPC UA", color: "#8b5cf6" },
  lora: { label: "LoRaWAN", color: "#06b6d4" },
  esp32: { label: "ESP32 MQTT", color: "#f59e0b" },
  sensor_controller: { label: "Controller", color: "#10b981" },
  plc: { label: "PLC Direct", color: "#ec4899" },
};

export default function ProtocolDistributionDonut({
  devices = [],
  totalGateways = 0,
}: ProtocolDistributionDonutProps) {
  const chartData = useMemo(() => {
    if (!devices || devices.length === 0) {
      // Demo baseline breakdown if no devices registered yet
      return [
        { name: "Modbus TCP", value: 3, color: "#0284c7" },
        { name: "OPC UA", value: 2, color: "#8b5cf6" },
        { name: "LoRaWAN", value: 4, color: "#06b6d4" },
        { name: "ESP32 MQTT", value: 5, color: "#f59e0b" },
      ];
    }

    const counts: Record<string, number> = {};
    devices.forEach((d) => {
      const k = d.kind || "esp32";
      counts[k] = (counts[k] || 0) + 1;
    });

    return Object.entries(counts).map(([kind, count]) => {
      const config = PROTOCOL_CONFIG[kind] || { label: kind.toUpperCase(), color: "#64748b" };
      return {
        name: config.label,
        value: count,
        color: config.color,
      };
    });
  }, [devices]);

  const totalPoints = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            Protocol & Network Mix
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Fieldbus & direct telemetry transports
          </p>
        </div>
        <div className="h-7 w-7 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
          <Network className="h-4 w-4" />
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
                  const pct = totalPoints > 0 ? Math.round(((data.value as number) / totalPoints) * 100) : 0;
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
            {chartData.length}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-violet-500 font-semibold">
            PROTOCOLS
          </span>
        </div>
      </div>

      {/* Protocol Legend Pill List */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3 border-t border-slate-200/50 dark:border-slate-800/80">
        {chartData.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-[10px] font-mono"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
            <span className="font-bold text-slate-900 dark:text-white ml-0.5">({item.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
