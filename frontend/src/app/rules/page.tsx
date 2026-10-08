"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Sliders, Plus, Trash2, Edit2, X, Check, AlertCircle } from "lucide-react";

export default function RulesPage() {
  const { data: rules, mutate: mutateRules } = useSWR("/rules", () => api.rules.list());
  const { data: devices } = useSWR("/devices", () => api.devices.list());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);

  const [deviceId, setDeviceId] = useState<number | "">("");
  const [metric, setMetric] = useState("");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState<number | "">("");
  const [severity, setSeverity] = useState("warning");
  const [debounceSeconds, setDebounceSeconds] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setEditingRuleId(null);
    setDeviceId(devices && devices.length > 0 ? devices[0].id : "");
    setMetric("");
    setOperator(">");
    setThreshold("");
    setSeverity("warning");
    setDebounceSeconds(0);
    setEnabled(true);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deviceId === "" || threshold === "") return;

    setSubmitting(true);
    try {
      const payload = {
        device_id: Number(deviceId),
        metric: metric.trim(),
        operator,
        threshold: Number(threshold),
        severity,
        debounce_seconds: Number(debounceSeconds),
        enabled,
      };

      if (editingRuleId) {
        await api.rules.update(editingRuleId, payload);
      } else {
        await api.rules.create(payload);
      }

      mutateRules();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error saving rule: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this alarm rule?")) {
      try {
        await api.rules.delete(id);
        mutateRules();
      } catch (err: any) {
        alert(`Failed to delete rule: ${err.message}`);
      }
    }
  };

  const handleToggleEnabled = async (rule: any) => {
    try {
      await api.rules.update(rule.id, { enabled: !rule.enabled });
      mutateRules();
    } catch (err: any) {
      alert(`Failed to toggle rule: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Alarm Rules Configuration</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Define automated conditions, threshold boundaries, and debounce timers
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-lg shadow-sky-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Alarm Rule</span>
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800/80">
              <tr>
                <th className="py-3 px-5">Active</th>
                <th className="py-3 px-5">Target Device</th>
                <th className="py-3 px-5">Metric</th>
                <th className="py-3 px-5">Condition</th>
                <th className="py-3 px-5">Severity</th>
                <th className="py-3 px-5">Debounce Window</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules && rules.length > 0 ? (
                rules.map((rule: any) => {
                  const targetDev = devices?.find((d: any) => d.id === rule.device_id);
                  return (
                    <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleEnabled(rule)}
                          className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-sky-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-white">
                        {targetDev ? targetDev.name : `Device #${rule.device_id}`}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-sky-400 font-medium">{rule.metric}</td>
                      <td className="py-3.5 px-5 font-mono font-bold text-white">
                        {rule.operator} {rule.threshold}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                            rule.severity === "critical"
                              ? "bg-rose-950 text-rose-400 border border-rose-800"
                              : "bg-amber-950 text-amber-400 border border-amber-800"
                          }`}
                        >
                          {rule.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px]">
                        {rule.debounce_seconds ? `${rule.debounce_seconds}s` : "None (0s)"}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Sliders className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">No Alarm Rules Configured</p>
                    <p className="text-xs text-slate-500 mt-1">Create rules to monitor temperature, pressure, etc.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-bold text-white mb-4">Create Alarm Rule</h2>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Machine</label>
                <select
                  required
                  value={deviceId}
                  onChange={(e: any) => setDeviceId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none"
                >
                  <option value="">Select a device...</option>
                  {(devices || []).map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.device_key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Metric Name</label>
                <input
                  type="text"
                  required
                  value={metric}
                  onChange={(e: any) => setMetric(e.target.value)}
                  placeholder="temperature, pressure, motor_speed"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Condition Operator</label>
                  <select
                    value={operator}
                    onChange={(e: any) => setOperator(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none font-mono"
                  >
                    <option value=">">&gt; (Greater than)</option>
                    <option value="<">&lt; (Less than)</option>
                    <option value=">=">&gt;= (Greater or equal)</option>
                    <option value="<=">&lt;= (Less or equal)</option>
                    <option value="==">== (Exact equal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Threshold Value</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={threshold}
                    onChange={(e: any) => setThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="75.0"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e: any) => setSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none capitalize"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Debounce (Seconds)</label>
                  <input
                    type="number"
                    min="0"
                    value={debounceSeconds}
                    onChange={(e: any) => setDebounceSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-md shadow-sky-600/30"
                >
                  {submitting ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
