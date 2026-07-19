/**
 * useAiChat: availability guard + async session bootstrap for the AI panel.
 *
 * It probes {@link isAiAvailable} (does the optional `ai` SDK resolve?) and, when
 * present, builds the framework-agnostic {@link PptxAiChatSession} for the given
 * bridge + config. The heavy `@ai-sdk/vue` `useChat` wiring lives in
 * {@link useAiConversation}, which the panel only mounts once `state === 'ready'`.
 */
import { createAiChatSession, isAiAvailable } from 'pptx-viewer-shared/ai';
import type { PptxAiBridge, PptxAiChatSession, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { ref, shallowRef } from 'vue';
import type { Ref, ShallowRef } from 'vue';

/** Lifecycle of the AI session bootstrap. */
export type AiChatInitState = 'checking' | 'unavailable' | 'ready' | 'error';

export interface UseAiChatResult {
	state: Ref<AiChatInitState>;
	session: ShallowRef<PptxAiChatSession | null>;
	initError: ShallowRef<Error | undefined>;
}

export function useAiChat(bridge: PptxAiBridge, config: PptxAiConfig): UseAiChatResult {
	const state = ref<AiChatInitState>('checking');
	const session = shallowRef<PptxAiChatSession | null>(null);
	const initError = shallowRef<Error | undefined>(undefined);

	// A monotonic token guards against a stale async resolution winning after the
	// bridge/config changed (the panel is normally mounted once, but this keeps
	// the bootstrap race-safe regardless).
	let token = 0;
	void (async () => {
		const current = ++token;
		state.value = 'checking';
		session.value = null;
		initError.value = undefined;
		try {
			const available = await isAiAvailable();
			if (current !== token) {
				return;
			}
			if (!available) {
				state.value = 'unavailable';
				return;
			}
			const built = await createAiChatSession(bridge, config);
			if (current !== token) {
				return;
			}
			session.value = built;
			state.value = 'ready';
		} catch (err) {
			if (current !== token) {
				return;
			}
			initError.value = err instanceof Error ? err : new Error(String(err));
			state.value = 'error';
		}
	})();

	return { state, session, initError };
}
