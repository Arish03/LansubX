"use client";

import "./globals.css";
import React from "react";
import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useLiveSocket } from "@/lib/useLiveSocket";
import {
  LayoutDashboard,
  Cpu,
  Bell,
  Sliders,
  Network,
  Settings,
  LogOut,
  Radio,
  Activity,
  Layers,
} from "lucide-react";

function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const { status: wsStatus } = useLiveSocket();

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
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex flex-col border-r border-slate-800 bg-slate-900/90 backdrop-blur-md">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-600/30">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-wider text-white">LANSUB <span className="text-sky-400">X</span></span>
              <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase">Industrial IoT</span>
            </div>
          </div>
        </div>

        {/* Live Broker Status */}
        <div className="px-5 py-3 mx-4 my-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
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
            <span className="text-xs font-mono uppercase text-slate-400">Live Feed</span>
          </div>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded capitalize ${
              wsStatus === "connected"
                ? "text-emerald-400 bg-emerald-950/50"
                : wsStatus === "connecting"
                ? "text-amber-400 bg-amber-950/50"
                : "text-rose-400 bg-rose-950/50"
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
                    ? "bg-sky-600/20 text-sky-400 border border-sky-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-sky-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* User Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-medium text-slate-200 truncate">{user?.email}</p>
              <span className="inline-block px-1.5 py-0.5 mt-1 text-[10px] font-mono uppercase rounded bg-slate-800 text-sky-400 border border-slate-700">
                {user?.role}
              </span>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-950/95">
        <div className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>Lansub X | Industrial IoT Platform</title>
        <meta
          name="description"
          content="Unified industrial IoT telemetry, real-time alerting, and remote machine control."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-sky-500 selection:text-white">
        <AuthProvider>
          <NavigationShell>{children}</NavigationShell>
        </AuthProvider>
      </body>
    </html>
  );
}
