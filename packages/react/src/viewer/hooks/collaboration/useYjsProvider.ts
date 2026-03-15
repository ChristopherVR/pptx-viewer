/**
 * useYjsProvider — Manages the Yjs document and WebSocket provider lifecycle.
 *
 * Creates a Y.Doc and connects via WebSocketProvider to the collaboration
 * server. Exposes connection status and cleanup on unmount.
 *
 * This hook is intentionally thin — it only manages the transport layer.
 * Application-level collaboration logic lives in useCollaborativeState
 * and usePresenceTracking.
 *
 * @module collaboration/useYjsProvider
 */
import { useEffect, useRef, useState, useCallback } from "react";

import type { CollaborationConfig, ConnectionStatus } from "./types";
import { validateRoomId } from "./sanitize";

// ---------------------------------------------------------------------------
// Yjs type stubs (lazy-loaded to avoid bundling when unused)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
interface YDoc {
  destroy: () => void;
  getMap: (name: string) => any;
  getArray: (name: string) => any;
}

interface Awareness {
  setLocalStateField: (field: string, value: any) => void;
  getLocalState: () => any;
  getStates: () => Map<number, any>;
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  clientID: number;
}

interface YWebSocketProvider {
  awareness: Awareness;
  wsconnected: boolean;
  destroy: () => void;
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Hook input / output
// ---------------------------------------------------------------------------

export interface UseYjsProviderInput {
  config: CollaborationConfig;
}

export interface UseYjsProviderResult {
  /** Current WebSocket connection status. */
  status: ConnectionStatus;
  /** The Yjs awareness instance (null until connected). */
  awareness: Awareness | null;
  /** The Yjs document (null until initialised). */
  doc: YDoc | null;
  /** Local awareness client ID. */
  clientId: number | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Lazily loads `yjs` and `y-websocket`, creates a Y.Doc and
 * WebSocketProvider, and tracks the connection lifecycle.
 *
 * The Yjs packages are dynamically imported so they are fully
 * tree-shaken when collaboration is not enabled.
 */
export function useYjsProvider({
  config,
}: UseYjsProviderInput): UseYjsProviderResult {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [doc, setDoc] = useState<YDoc | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);

  // Keep a ref to cleanup functions so we can teardown on unmount or config change
  const cleanupRef = useRef<(() => void) | null>(null);

  const init = useCallback(async () => {
    // Validate room ID before connecting
    const roomId = validateRoomId(config.roomId);

    setStatus("connecting");

    try {
      // Dynamic imports — zero bundle cost when unused
      const [Y, { WebsocketProvider }] = await Promise.all([
        import("yjs"),
        import("y-websocket"),
      ]);

      const yDoc = new Y.Doc() as unknown as YDoc;
      const provider = new WebsocketProvider(
        config.serverUrl,
        roomId,
        yDoc as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        {
          params: config.authToken ? { token: config.authToken } : undefined,
        },
      ) as unknown as YWebSocketProvider;

      const handleStatus = (event: { status: string }) => {
        if (event.status === "connected") {
          setStatus("connected");
        } else if (event.status === "disconnected") {
          setStatus("disconnected");
        }
      };

      provider.on("status", handleStatus);

      if (provider.wsconnected) {
        setStatus("connected");
      }

      setDoc(yDoc);
      setAwareness(provider.awareness);
      setClientId(provider.awareness.clientID);

      // Store cleanup
      cleanupRef.current = () => {
        provider.off("status", handleStatus);
        provider.destroy();
        yDoc.destroy();
        setDoc(null);
        setAwareness(null);
        setClientId(null);
        setStatus("disconnected");
      };
    } catch (err) {
      // If yjs or y-websocket are not installed, degrade gracefully
      console.warn(
        "[pptx-viewer] Collaboration packages not available:",
        err instanceof Error ? err.message : err,
      );
      setStatus("error");
    }
  }, [config.roomId, config.serverUrl, config.authToken]);

  useEffect(() => {
    init();
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [init]);

  return { status, awareness, doc, clientId };
}
