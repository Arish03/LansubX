"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Radio,
  Cpu,
  ShieldCheck,
  Zap,
  Network,
  Sliders,
  Bell,
  Layers,
  Terminal,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Server,
  Lock,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 cyber-grid-bg relative overflow-x-hidden transition-colors">
      {/* Ambient glowing radial backlights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-sky-500/20 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 left-10 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Floating Glass Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/80 dark:border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/30 border border-white/20 group-hover:scale-105 transition-transform">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-wider text-slate-900 dark:text-white font-sans">
                LANSUB <span className="text-sky-400">X</span>
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest">
                Industrial IoT Platform
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-sky-400 transition-colors">Features</a>
            <a href="#protocols" className="hover:text-sky-400 transition-colors">Protocols</a>
            <a href="#architecture" className="hover:text-sky-400 transition-colors">Architecture</a>
            <Link
              href="/demo"
              className="flex items-center space-x-1.5 text-emerald-500 hover:text-emerald-400 font-bold"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 beacon-live" />
              <span>Live Stream Demo</span>
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="glass-card px-4 py-2 rounded-xl text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-500 dark:hover:text-sky-400 transition-all shadow-sm"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-xs font-mono font-bold text-white shadow-lg shadow-sky-600/30 transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 max-w-7xl mx-auto text-center relative z-10">
        {/* Release Pill */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-500 dark:text-sky-400 text-xs font-mono mb-8 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-sky-400 beacon-live" />
          <span className="font-semibold uppercase tracking-wider">Lansub X 2.0 Released</span>
          <span className="text-slate-400">&bull;</span>
          <span>Real-time Industrial Telemetry &amp; Glassmorphism Cockpit</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
          Unified Supervisory Control &amp;{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400">
            Real-Time Telemetry
          </span>{" "}
          Cockpit
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-sans leading-relaxed">
          Ingest Modbus TCP, OPC UA, LoRaWAN, and Direct MQTT machinery in real time.
          Sub-millisecond alerting, live WebSocket stream curves, and bidirectional machine commands.
        </p>

        {/* Call to Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-sm font-semibold text-white shadow-xl shadow-sky-600/35 flex items-center justify-center space-x-2.5 transition-all group"
          >
            <span>Launch Operator Cockpit</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/demo"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl glass-card text-sm font-mono font-semibold text-slate-900 dark:text-white hover:border-sky-500/50 flex items-center justify-center space-x-2.5 transition-all shadow-md"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 beacon-live" />
            <span>Explore Live Stream Demo</span>
          </Link>
        </div>

        {/* Cockpit Glass Mockup Preview */}
        <div className="mt-16 max-w-5xl mx-auto glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-left border border-slate-200/80 dark:border-white/10">
          <div className="scanline-effect" />

          {/* Browser / Shell Header */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200/50 dark:border-white/10">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-rose-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-3 text-xs font-mono text-slate-500">
                https://cockpit.lansubx.io/dashboard
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] font-mono text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 beacon-live" />
              <span>SUPERVISORY NETWORK ONLINE</span>
            </div>
          </div>

          {/* Mock KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="glass-card p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Monitored Machines</span>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">16 Registered</p>
              <span className="text-[10px] font-mono text-sky-500">100% Modbus &amp; OPC UA</span>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <span className="text-[10px] font-mono text-emerald-500 uppercase font-semibold">Active Online</span>
              <p className="text-2xl font-bold font-mono text-emerald-500 mt-1">14 Online</p>
              <span className="text-[10px] font-mono text-emerald-400">Sub-10ms Heartbeat</span>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Debounced Rules</span>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">24 Active</p>
              <span className="text-[10px] font-mono text-violet-400">Zero False Positives</span>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Broker Ingress</span>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">1,820 pts/s</p>
              <span className="text-[10px] font-mono text-sky-400">Redis Pub/Sub</span>
            </div>
          </div>

          {/* Quick Mock Stream Preview Banner */}
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-500/10 via-slate-900/40 to-transparent">
            <div>
              <div className="flex items-center space-x-2">
                <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  Live Industrial Multi-Metric Stream Studio
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                Observe live curves for Temperature (°C), Pressure (bar), Vibration (mm/s), Motor RPM, and Power Load.
              </p>
            </div>
            <Link
              href="/demo"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-mono font-semibold text-white shadow-md flex items-center space-x-1.5 self-start sm:self-auto"
            >
              <span>Open Live Demo</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono text-sky-500 dark:text-sky-400 uppercase tracking-widest font-semibold">
            Architected for Modern Industry
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
            Engineered for High-Frequency Industrial Telemetry
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-3 text-sm">
            Everything your operations team needs to observe machinery, configure automated safety rules, and send commands.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="glass-glow-cyan" />
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4">
              <Network className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Multi-Protocol Bridges
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Connect Modbus TCP holding registers, OPC UA secure endpoints, LoRaWAN gateways via ChirpStack, and ESP32 MQTT controllers into unified JSON streams.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="glass-glow-emerald" />
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <Radio className="h-5 w-5 beacon-live" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Real-Time WebSocket Stream
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Redis-backed pub/sub pipeline pushes live data points directly into client browser canvas with zero polling latency and smooth bezier spline interpolation.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="glass-glow-rose" />
            <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Debounced Rules Engine
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Configure dynamic condition rules with debounce timers to eliminate sensor jitter. Alarms auto-resolve when nominal metrics are restored.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="glass-glow-purple" />
            <div className="h-10 w-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-4">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Bidirectional Machine Control
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Dispatch remote parameters and commands (RPM targets, valve states, reboot triggers) with verifiable end-to-end MQTT acknowledgment tracking.
            </p>
          </div>
        </div>
      </section>

      {/* Protocols & Transports Section */}
      <section id="protocols" className="py-16 px-6 max-w-7xl mx-auto border-t border-slate-200/50 dark:border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="text-xs font-mono text-sky-500 uppercase tracking-widest font-semibold">
              Interoperability
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
              Built for Heterogeneous Plant Equipment
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-lg font-sans leading-relaxed">
              Whether retrofitting legacy 24V RS-485 Modbus machinery or integrating brand-new Industry 4.0 OPC UA workcells, Lansub X speaks your plant's native language.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto font-mono text-xs">
            <div className="glass-card p-3 rounded-xl flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              <span>Modbus TCP</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              <span>OPC UA</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              <span>LoRaWAN / ChirpStack</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Direct MQTT ESP32</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Industrial PLCs</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>WebSockets &amp; REST</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-20 px-6 max-w-5xl mx-auto text-center">
        <div className="glass-panel rounded-3xl p-10 relative overflow-hidden shadow-2xl border border-slate-200/80 dark:border-white/10">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-xl shadow-sky-500/30 mx-auto mb-6">
            <Activity className="h-8 w-8 text-white" />
          </div>

          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Ready to Monitor Your Plant in Real Time?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-lg mx-auto mt-3">
            Deploy in minutes with Docker Compose or connect your field hardware straight away.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-xs font-mono font-bold text-white shadow-lg shadow-sky-600/30 flex items-center space-x-2"
            >
              <span>Sign In to Cockpit</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/demo"
              className="px-6 py-3 rounded-xl glass-card text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 hover:border-sky-500"
            >
              <span>Launch Live Stream Demo</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200/60 dark:border-white/10 glass-panel">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">LANSUB X</span>
            <span>&bull;</span>
            <span>Open Industrial Telemetry &amp; Supervisory Platform</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/demo" className="hover:text-sky-400 transition-colors">Live Demo</Link>
            <Link href="/login" className="hover:text-sky-400 transition-colors">Sign In</Link>
            <a href="http://localhost:6500/docs" target="_blank" rel="noreferrer" className="hover:text-sky-400 transition-colors">
              OpenAPI Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
