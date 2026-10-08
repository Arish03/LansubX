"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-10 w-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-mono text-slate-400">Loading Lansub X Platform...</p>
      </div>
    </div>
  );
}
