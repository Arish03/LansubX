"use client";

import "./globals.css";
import React from "react";
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
} from "lucide-react";

function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated, loading } = useAuth();
  const { status: wsStatus } = useLiveSocket();
  const { theme, toggleTheme } = useTheme();

  // Prevent flash of unauthenticated layout during token verification
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-slate-500 dark:text-slate-400">Connecting to Lansub X...</p>
        </div>
      </div>
    );
  }

  // If on login or landing page, render without dashboard shell
  if (!isAuthenticated || pathname === "/login") {
    return <main className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</main>;
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
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 backdrop-blur-md">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-600/30">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-wider text-slate-900 dark:text-white">LANSUB <span className="text-sky-500">X</span></span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium tracking-widest uppercase">Industrial IoT</span>
            </div>
          </div>
        </div>

        {/* Live Broker Status */}
        <div className="px-5 py-3 mx-4 my-3 rounded-lg bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                wsStatus === "connected"
                  ? "bg-emerald-500 shadow-sm shadow-emerald-500"
                  : wsStatus === "connecting"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs font-sans font-medium uppercase text-slate-600 dark:text-slate-400">Live Feed</span>
          </div>
          <span
            className={`text-[11px] font-sans font-semibold px-2 py-0.5 rounded capitalize ${
              wsStatus === "connected"
                ? "text-emerald-700 bg-emerald-100 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800/40"
                : wsStatus === "connecting"
                ? "text-amber-700 bg-amber-100 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800/40"
                : "text-rose-700 bg-rose-100 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/50 dark:border-rose-800/40"
            }`}
          >
            {wsStatus}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-sm dark:bg-sky-600/20 dark:text-sky-400 dark:border-sky-500/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-500 dark:text-slate-400"}`} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* User Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{user?.email}</p>
              <span className="inline-block px-1.5 py-0.5 mt-1 text-[10px] font-sans font-semibold uppercase rounded bg-slate-200 text-sky-700 border border-slate-300 dark:bg-slate-800 dark:text-sky-400 dark:border-slate-700">
                {user?.role}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleTheme}
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light (White) Mode"}
                className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-sky-500 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <div className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Lansub X | Industrial IoT Platform</title>
        <meta
          name="description"
          content="Unified industrial IoT telemetry, real-time alerting, and remote machine control."
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
