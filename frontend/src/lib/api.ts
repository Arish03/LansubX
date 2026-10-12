export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1") && envUrl !== "/api/proxy") {
      return envUrl;
    }
    // In browser: Route through Next.js rewrite proxy (/api/proxy -> backend:6500)
    // Uses the same port (6001) that is already open on Azure NSG, with zero CORS issues!
    return "/api/proxy";
  }
  return process.env.BACKEND_INTERNAL_URL || "http://backend:6500";
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lansubx_token");
}

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("lansubx_token", token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("lansubx_token");
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const baseUrl = getApiUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (err: any) {
    if (err?.name === "TypeError" || String(err).includes("Failed to fetch")) {
      throw new Error(`Cannot connect to Backend API. Ensure the backend container is running.`);
    }
    throw err;
  }

  if (!res.ok) {
    let errorDetail = "An unexpected error occurred";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = `Request failed with status ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

// API methods
export const api = {
  auth: {
    login: (body: any) => apiFetch<{ access_token: string; user: any }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    register: (body: any) => apiFetch<{ access_token: string; user: any }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
    me: () => apiFetch<any>("/auth/me"),
    logout: () => apiFetch<any>("/auth/logout", { method: "POST" }),
  },
  devices: {
    list: () => apiFetch<any[]>("/devices"),
    get: (id: number) => apiFetch<any>(`/devices/${id}`),
    create: (body: any) => apiFetch<any>("/devices", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: any) => apiFetch<any>(`/devices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`/devices/${id}`, { method: "DELETE" }),
  },
  gateways: {
    list: () => apiFetch<any[]>("/gateways"),
    create: (body: any) => apiFetch<any>("/gateways", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`/gateways/${id}`, { method: "DELETE" }),
  },
  templates: {
    list: () => apiFetch<any[]>("/templates"),
  },
  telemetry: {
    getLatest: (deviceId: number) => apiFetch<Record<string, { value: number; ts: string }>>(`/devices/${deviceId}/telemetry/latest`),
    getHistory: (deviceId: number, params?: { metric?: string; start?: string; end?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.metric) q.append("metric", params.metric);
      if (params?.start) q.append("start", params.start);
      if (params?.end) q.append("end", params.end);
      if (params?.limit) q.append("limit", params.limit.toString());
      return apiFetch<any[]>(`/devices/${deviceId}/telemetry?${q.toString()}`);
    },
    getMetrics: (deviceId: number) => apiFetch<string[]>(`/devices/${deviceId}/metrics`),
  },
  rules: {
    list: (deviceId?: number) => {
      const q = deviceId ? `?device_id=${deviceId}` : "";
      return apiFetch<any[]>(`/rules${q}`);
    },
    create: (body: any) => apiFetch<any>("/rules", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: any) => apiFetch<any>(`/rules/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`/rules/${id}`, { method: "DELETE" }),
  },
  alarms: {
    list: (params?: { state?: string; device_id?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.state) q.append("state", params.state);
      if (params?.device_id) q.append("device_id", params.device_id.toString());
      if (params?.limit) q.append("limit", params.limit.toString());
      return apiFetch<any[]>(`/alarms?${q.toString()}`);
    },
    ack: (id: number) => apiFetch<any>(`/alarms/${id}/ack`, { method: "POST" }),
    resolve: (id: number) => apiFetch<any>(`/alarms/${id}/resolve`, { method: "POST" }),
  },
  commands: {
    list: (deviceId: number) => apiFetch<any[]>(`/devices/${deviceId}/commands`),
    send: (deviceId: number, body: { action: string; params?: any }) =>
      apiFetch<any>(`/devices/${deviceId}/commands`, { method: "POST", body: JSON.stringify(body) }),
  },
  dashboard: {
    getSummary: () => apiFetch<any>("/dashboard"),
  },
};
