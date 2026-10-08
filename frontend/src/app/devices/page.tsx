"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useLiveSocket, LiveMessage } from "@/lib/useLiveSocket";
import {
  Cpu,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

const KINDS = [
  { id: "esp32", name: "ESP32 (Direct MQTT)", direct: true },
  { id: "sensor_controller", name: "Sensor Controller (Direct MQTT)", direct: true },
  { id: "plc", name: "PLC (Direct MQTT)", direct: true },
  { id: "modbus", name: "Modbus TCP Gateway", direct: false },
  { id: "opcua", name: "OPC UA Gateway", direct: false },
  { id: "lora", name: "LoRaWAN (ChirpStack)", direct: false },
];

export default function DevicesPage() {
  const { data: devices, mutate, isLoading } = useSWR("/devices", () => api.devices.list());
  const { data: gateways } = useSWR("/gateways", () => api.gateways.list());
  const { data: templates } = useSWR("/templates", () => api.templates.list());

  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Wizard state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceKind, setNewDeviceKind] = useState("esp32");
  const [newDeviceGatewayId, setNewDeviceGatewayId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<any | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Real-time status update
  const handleLiveMessage = useCallback(
    (msg: LiveMessage) => {
      if (msg.type === "device_status" || msg.type === "telemetry") {
        mutate();
      }
    },
    [mutate]
  );
  useLiveSocket(handleLiveMessage);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleDeleteDevice = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete device "${name}"? All telemetry and alarms will be removed.`)) {
      try {
        await api.devices.delete(id);
        mutate();
      } catch (err: any) {
        alert(`Failed to delete device: ${err.message}`);
      }
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        name: newDeviceName,
        kind: newDeviceKind,
      };
      if (newDeviceGatewayId !== "") {
        payload.gateway_id = Number(newDeviceGatewayId);
      }
      const res = await api.devices.create(payload);
      setCreatedResult(res);
      mutate();
    } catch (err: any) {
      alert(`Error creating device: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDevices = (devices || []).filter((d: any) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.device_key.toLowerCase().includes(search.toLowerCase());
    const matchesKind = selectedKind === "all" || d.kind === selectedKind;
    return matchesSearch && matchesKind;
  });

  const selectedTemplate = templates?.find((t: any) => t.kind === newDeviceKind);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Device Inventory</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Provision, monitor, and configure machines across direct MQTT and gateway connections
          </p>
        </div>
        <button
          onClick={() => {
            setCreatedResult(null);
            setNewDeviceName("");
            setNewDeviceKind("esp32");
            setNewDeviceGatewayId("");
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-lg shadow-sky-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Device</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by device name or key..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
            className="bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 py-2 px-3 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Device Kinds</option>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800/80">
              <tr>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Device Name</th>
                <th className="py-3 px-5">Device Key</th>
                <th className="py-3 px-5">Protocol / Kind</th>
                <th className="py-3 px-5">Gateway</th>
                <th className="py-3 px-5">Last Seen</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDevices.length > 0 ? (
                filteredDevices.map((device: any) => {
                  const isDirect = ["esp32", "sensor_controller", "plc"].includes(device.kind);
                  return (
                    <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              device.is_online
                                ? "bg-emerald-400 shadow-sm shadow-emerald-400"
                                : "bg-slate-600"
                            }`}
                          />
                          <span
                            className={`font-mono text-[11px] ${
                              device.is_online ? "text-emerald-400 font-medium" : "text-slate-500"
                            }`}
                          >
                            {device.is_online ? "Online" : "Offline"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-white">
                        <a
                          href={`/devices/${device.id}`}
                          className="hover:text-sky-400 transition-colors flex items-center space-x-1"
                        >
                          <span>{device.name}</span>
                        </a>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-sky-400 text-[11px]">
                          <span>{device.device_key}</span>
                          <button
                            onClick={() => handleCopyKey(device.device_key)}
                            title="Copy Key"
                            className="text-slate-500 hover:text-white"
                          >
                            {copiedKey === device.device_key ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {device.kind}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px]">
                        {device.gateway_id ? `#${device.gateway_id}` : isDirect ? "Direct MQTT" : "None"}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 text-[11px]">
                        {device.last_seen_at
                          ? new Date(device.last_seen_at).toLocaleString()
                          : "Never connected"}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <a
                            href={`/devices/${device.id}`}
                            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors"
                            title="Open Device Dashboard"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteDevice(device.id, device.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                            title="Delete Device"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Cpu className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">No Devices Found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {search ? "Try adjusting your search criteria" : "Click 'Add New Device' to onboard a machine."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Device Modal Wizard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {!createdResult ? (
              <>
                <div className="flex items-center space-x-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Add Machine / Device</h2>
                    <p className="text-xs text-slate-400 font-mono">Step 1 of 2: Configure device parameters</p>
                  </div>
                </div>

                <form onSubmit={handleCreateDevice} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Device Name</label>
                    <input
                      type="text"
                      required
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      placeholder="e.g. CNC Spindle Controller #1"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Machine Protocol / Kind</label>
                    <select
                      value={newDeviceKind}
                      onChange={(e) => setNewDeviceKind(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    >
                      {KINDS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Gateway selector if non-direct */}
                  {!["esp32", "sensor_controller", "plc"].includes(newDeviceKind) && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Associated Gateway</label>
                      <select
                        value={newDeviceGatewayId}
                        onChange={(e) => setNewDeviceGatewayId(e.target.value ? Number(e.target.value) : "")}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                      >
                        <option value="">None (Standalone or configured in gateway.yaml)</option>
                        {(gateways || [])
                          .filter((g: any) => g.type === newDeviceKind)
                          .map((g: any) => (
                            <option key={g.id} value={g.id}>
                              {g.name} (#{g.id})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Template preview */}
                  {selectedTemplate && (
                    <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center space-x-1.5 text-xs text-sky-400 font-mono font-medium mb-1.5">
                        <Info className="h-3.5 w-3.5" />
                        <span>Default Template: {selectedTemplate.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Default metrics:{" "}
                        <span className="font-mono text-slate-300">
                          {selectedTemplate.config.holding_registers
                            ? selectedTemplate.config.holding_registers.map((r: any) => r.metric).join(", ")
                            : selectedTemplate.config.nodes
                            ? selectedTemplate.config.nodes.map((n: any) => n.metric).join(", ")
                            : selectedTemplate.config.metrics
                            ? selectedTemplate.config.metrics.map((m: any) => m.field).join(", ")
                            : "Standard"}
                        </span>
                      </p>
                    </div>
                  )}

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
                      {submitting ? "Provisioning..." : "Create Device"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Success / One-Time Secret Display */
              <div className="space-y-5">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Device Successfully Provisioned!</h2>
                    <p className="text-xs text-slate-400 font-mono">Store credentials securely</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block">Device Key (Username)</span>
                    <span className="text-sky-400 font-bold text-sm">{createdResult.device_key}</span>
                  </div>

                  {createdResult.secret && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-amber-400 uppercase text-[10px] block font-bold">
                        One-Time Secret Token (Password)
                      </span>
                      <div className="flex items-center justify-between mt-1 p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="text-white font-mono break-all">{createdResult.secret}</span>
                        <button
                          onClick={() => handleCopySecret(createdResult.secret)}
                          className="ml-2 text-slate-400 hover:text-white"
                        >
                          {copiedSecret ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {createdResult.secret ? (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-start space-x-2 text-[11px] text-amber-300">
                    <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Important:</strong> This secret is shown only once and cannot be retrieved again.
                      Add this user to the Mosquitto broker with:
                      <code className="block mt-1 font-mono text-[10px] text-white bg-slate-950 p-1.5 rounded">
                        ./scripts/add_mqtt_user.sh {createdResult.device_key} {createdResult.secret}
                      </code>
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    This gateway device publishes telemetry through the gateway translation loop using the shared gateway credentials.
                  </p>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-md shadow-sky-600/30"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
