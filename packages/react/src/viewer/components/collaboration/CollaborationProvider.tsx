/**
 * CollaborationProvider — React context provider for real-time collaboration.
 *
 * Wraps the viewer content and exposes collaboration state (connection status,
 * remote user presence, broadcast function) to all child components via
 * `useCollaboration()`.
 *
 * This component is only rendered when `collaboration` config is provided to
 * `PowerPointViewer`, ensuring zero bundle/runtime cost when unused.
 *
 * @module collaboration/CollaborationProvider
 */
import React, { createContext, useContext } from "react";

import type {
  CollaborationConfig,
  CollaborationContextValue,
} from "../../hooks/collaboration/types";
import { useCollaborativeState } from "../../hooks/collaboration/useCollaborativeState";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CollaborationContext = createContext<CollaborationContextValue | null>(
  null,
);

/**
 * Access the collaboration context. Returns null when called outside a
 * `CollaborationProvider` (i.e. when collaboration is not enabled).
 */
export function useCollaboration(): CollaborationContextValue | null {
  return useContext(CollaborationContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface CollaborationProviderProps {
  config: CollaborationConfig;
  canvasWidth: number;
  canvasHeight: number;
  children: React.ReactNode;
}

export function CollaborationProvider({
  config,
  canvasWidth,
  canvasHeight,
  children,
}: CollaborationProviderProps): React.ReactElement {
  const value = useCollaborativeState({
    config,
    canvasWidth,
    canvasHeight,
  });

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}
