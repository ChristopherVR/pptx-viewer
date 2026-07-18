/**
 * useAiChat: availability guard + async session bootstrap for the AI panel.
 *
 * It probes {@link isAiAvailable} (does the optional `ai` SDK resolve?) and, when
 * present, builds the framework-agnostic {@link PptxAiChatSession} for the given
 * bridge + config. The heavy `@ai-sdk/react` `useChat` wiring lives in
 * {@link useAiConversation}, which the panel only mounts once `state === 'ready'`.
 */
import { createAiChatSession, isAiAvailable } from 'pptx-viewer-shared/ai';
import type { PptxAiBridge, PptxAiChatSession, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { useEffect, useRef, useState } from 'react';

/** Lifecycle of the AI session bootstrap. */
export type AiChatInitState = 'checking' | 'unavailable' | 'ready' | 'error';

export interface UseAiChatResult {
	state: AiChatInitState;
	session: PptxAiChatSession | null;
	initError?: Error;
}

export function useAiChat(bridge: PptxAiBridge, config: PptxAiConfig): UseAiChatResult {
	// Capture the config once so re-renders (a host passing an inline object)
	// do not tear down and rebuild the live session on every keystroke.
	const configRef = useRef(config);
	const [state, setState] = useState<AiChatInitState>('checking');
	const [session, setSession] = useState<PptxAiChatSession | null>(null);
	const [initError, setInitError] = useState<Error | undefined>(undefined);

	useEffect(() => {
		let cancelled = false;
		setState('checking');
		setSession(null);
		setInitError(undefined);
		void (async () => {
			try {
				const available = await isAiAvailable();
				if (cancelled) {
					return;
				}
				if (!available) {
					setState('unavailable');
					return;
				}
				const built = await createAiChatSession(bridge, configRef.current);
				if (cancelled) {
					return;
				}
				setSession(built);
				setState('ready');
			} catch (err) {
				if (cancelled) {
					return;
				}
				setInitError(err instanceof Error ? err : new Error(String(err)));
				setState('error');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [bridge]);

	return { state, session, initError };
}
