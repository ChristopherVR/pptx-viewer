/**
 * CollaborationProvider: React context provider for real-time collaboration.
 *
 * Wraps the viewer content and exposes collaboration state (connection status,
 * remote user presence, broadcast function) to all child components via
 * `useCollaboration()`.
 *
 * This provider is rendered unconditionally by `PowerPointViewer` so that
 * starting or stopping a collaboration session never changes the React tree
 * shape (which would force a full unmount/remount of the editor subtree). When
 * no `config` is supplied it stays completely dormant: it opens no transport,
 * tracks no presence, and exposes a `null` context value so `useCollaboration()`
 * reports "not collaborating". The Yjs packages remain dynamically imported, so
 * there is still zero bundle cost until a session actually starts.
 *
 * @module collaboration/CollaborationProvider
 */
import React, { createContext, useContext } from 'react';

import type {
	CollaborationConfig,
	CollaborationContextValue,
} from '../../hooks/collaboration/types';
import { useCollaborativeState } from '../../hooks/collaboration/useCollaborativeState';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

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
	/** Collaboration config, or `undefined`/omitted while no session is active. */
	config?: CollaborationConfig;
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
	// Returns `null` when `config` is absent, so consumers see "not collaborating"
	// while the provider itself stays mounted around stable children.
	const value = useCollaborativeState({
		config,
		canvasWidth,
		canvasHeight,
	});

	return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>;
}
