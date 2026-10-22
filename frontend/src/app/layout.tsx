"use client";

import "./globals.css";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useLiveSocket } from "@/lib/useLiveSocket";
import { ThemeProvider, useTheme } from "@/lib/theme";
import {
  LayoutDashboard,
  Cpu,
  Bell,
  SlidersHorizontal as Sliders,
  Network,
  Settings,
  LogOut,
  Radio,
  Activity,
  Layers,
  Sun,
  Moon,
  Clock,
  ShieldCheck,
  Server,
} from "lucide-react";

function DigitalClock() {
  const [timeStr, setTimeStr] = useState<string>("");
  const [utcStr, setUtcStr] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString());
      setUtcStr(now.toISOString().slice(11, 19) + " UTC");
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-500 dark:text-slate-400">
      <Clock className="h-3.5 w-3.5 text-sky-400" />
      <span>{timeStr}</span>
      <span className="text-[10px] text-slate-400 dark:text-slate-500">({utcStr})</span>
    </div>
  );
}

function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated, loading } = useAuth();
  const { status: wsStatus } = useLiveSocket();
  const { theme, toggleTheme } = useTheme();

  // Prevent flash of unauthenticated layout during token verification
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100 cyber-grid-bg">
        <div className="glass-card p-8 rounded-2xl flex flex-col items-center space-y-4">
          <div className="h-10 w-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">Initializing Lansub X Cockpit...</p>
        </div>
      </div>
    );
  }

  // If on login or landing page, render without dashboard shell
  if (!isAuthenticated || pathname === "/login") {
    return <main className="min-h-screen">{children}</main>;
  }

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Devices", href: "/devices", icon: Cpu },
    { label: "Alarms", href: "/alarms", icon: Bell },
    { label: "Rules", href: "/rules", icon: Sliders },
    { label: "Gateways", href: "/gateways", icon: Network },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-100 cyber-grid-bg">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex flex-col glass-panel border-r border-slate-200/80 dark:border-white/10 z-20">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/60 dark:border-white/10">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-wider text-slate-900 dark:text-white">
                LANSUB <span className="text-sky-400 font-extrabold">X</span>
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest">
                Industrial Telemetry
              </span>
            </div>
          </div>
        </div>

        {/* Live Broker Status Pill */}
        <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                wsStatus === "connected"
                  ? "bg-emerald-400 beacon-live"
                  : wsStatus === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
              Live Socket
            </span>
          </div>
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md uppercase ${
              wsStatus === "connected"
                ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"
                : wsStatus === "connecting"
                ? "text-amber-500 bg-amber-500/10 border border-amber-500/20"
                : "text-rose-500 bg-rose-500/10 border border-rose-500/20"
            }`}
          >
            {wsStatus}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium transition-all ${
                  isActive
                    ? "bg-sky-500/15 text-sky-500 dark:text-sky-400 border border-sky-500/30 shadow-md shadow-sky-500/10 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? "text-sky-500 dark:text-sky-400" : "text-slate-500 dark:text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* User Profile & Controls Footer */}
        <div className="p-4 border-t border-slate-200/60 dark:border-white/10 bg-slate-100/50 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
                {user?.email}
              </p>
              <span className="inline-block px-1.5 py-0.5 mt-1 text-[10px] font-mono font-semibold uppercase rounded bg-sky-500/10 text-sky-500 border border-sky-500/20">
                {user?.role}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleTheme}
                title={theme === "light" ? "Switch to Dark Cyber Mode" : "Switch to Light Mode"}
                className="p-2 text-slate-500 hover:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="p-2 text-slate-500 hover:text-rose-500 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Floating Glass Header */}
        <header className="h-14 px-8 border-b border-slate-200/60 dark:border-white/10 glass-panel flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 beacon-live" />
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
              Supervisory Control Network
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <DigitalClock />
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
            <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <Server className="h-3.5 w-3.5 text-sky-400" />
              <span>Broker: 1883</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Lansub X | Industrial Telemetry Platform</title>
        <meta
          name="description"
          content="Unified industrial IoT telemetry, real-time streaming charts, alerting, and remote machine control."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased selection:bg-sky-500 selection:text-white">
        <ThemeProvider>
          <AuthProvider>
            <NavigationShell>{children}</NavigationShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
