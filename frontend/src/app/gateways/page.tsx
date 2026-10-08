"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Network, Plus, Trash2, X, Info } from "lucide-react";

export default function GatewaysPage() {
  const { data: gateways, mutate } = useSWR("/gateways", () => api.gateways.list());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("modbus");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.gateways.create({
        name,
        type,
        config: {},
      });
      mutate();
      setIsModalOpen(false);
      setName("");
    } catch (err: any) {
      alert(`Error creating gateway: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this gateway?")) {
      try {
        await api.gateways.delete(id);
        mutate();
      } catch (err: any) {
        alert(`Failed to delete gateway: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Industrial Gateways</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Manage protocol translation bridges for legacy machinery and wireless field networks
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-lg shadow-sky-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Gateway</span>
        </button>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3 text-xs text-slate-400">
        <Info className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-medium">Gateway Protocol Translation Architecture</p>
          <p className="mt-1 leading-relaxed">
            Gateways poll industrial PLCs via Modbus TCP (port 502), query OPC UA nodes (port 4840), or ingest LoRa uplinks from ChirpStack, then convert the data into standard JSON telemetry frames published to Mosquitto.
          </p>
        </div>
      </div>

      {/* Gateways Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800/80">
              <tr>
                <th className="py-3 px-5">Gateway ID</th>
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5">Protocol Type</th>
                <th className="py-3 px-5">Registered At</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {gateways && gateways.length > 0 ? (
                gateways.map((gw: any) => (
                  <tr key={gw.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-sky-400 font-semibold">#{gw.id}</td>
                    <td className="py-3.5 px-5 font-medium text-white">{gw.name}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {gw.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 text-[11px]">
                      {new Date(gw.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => handleDelete(gw.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        title="Delete Gateway"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Network className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">No Gateways Configured</p>
                    <p className="text-xs text-slate-500 mt-1">Register a Modbus, OPC UA, or LoRa gateway.</p>
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

            <h2 className="text-base font-bold text-white mb-4">Register New Gateway</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Gateway Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e: any) => setName(e.target.value)}
                  placeholder="e.g. Shop Floor Modbus Master"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Protocol Type</label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none"
                >
                  <option value="modbus">Modbus TCP</option>
                  <option value="opcua">OPC UA</option>
                  <option value="lora">LoRaWAN (ChirpStack)</option>
                </select>
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
                  {submitting ? "Registering..." : "Create Gateway"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
