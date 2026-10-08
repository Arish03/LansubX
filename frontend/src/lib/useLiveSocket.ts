"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "./api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface LiveMessage {
  type: "telemetry" | "alarm" | "device_status" | "command_result" | "system";
  [key: string]: any;
}

type MessageListener = (msg: LiveMessage) => void;

export function useLiveSocket(onMessage?: MessageListener) {
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listenersRef = useRef<Set<MessageListener>>(new Set());

  if (onMessage) {
    listenersRef.current.add(onMessage);
  }

  const subscribe = useCallback((listener: MessageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      const token = getAuthToken();
      if (!token || unmounted) {
        setStatus("disconnected");
        return;
      }

      setStatus("connecting");
      const url = `${WS_URL}/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const data: LiveMessage = JSON.parse(event.data);
          listenersRef.current.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error("Error in live socket listener:", err);
            }
          });
        } catch (e) {
          console.warn("Non-JSON WebSocket message received:", event.data);
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setStatus("disconnected");
        wsRef.current = null;
        // Auto-reconnect after 3 seconds (FR-L4)
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn("WebSocket error:", err);
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { status, subscribe };
}
