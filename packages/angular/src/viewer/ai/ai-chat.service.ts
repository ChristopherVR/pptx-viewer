/**
 * AiChatService: Angular signal facade over the framework-agnostic
 * {@link createVanillaChat} controller from `pptx-viewer-shared/ai`.
 *
 * The React binding drives `@ai-sdk/react`'s `useChat`; Angular has no such
 * hook, so instead of pulling in a second SDK (`@ai-sdk/angular`) this reuses
 * the shared `createVanillaChat` controller (the same one the Vanilla binding
 * and the shared unit tests use). It exposes a plain subscribe / snapshot
 * contract, which we mirror into Angular signals here. The controller already
 * wires the client-side tool loop (`onToolCall` -> `session.executeToolCall` ->
 * `addToolOutput`), so this service only bootstraps it and surfaces state.
 *
 * Provide it at the panel component level so its lifecycle (and the lazily
 * loaded `ai` SDK behind it) is scoped to the open assistant.
 */
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import { createVanillaChat, isAiAvailable } from '../../internal/shared-ai';
import type {
	PptxAiBridge,
	PptxAiConfig,
	PptxAiUIMessage,
	ProposalView,
	VanillaChatController,
	VanillaChatSnapshot,
} from '../../internal/shared-ai';

/** Lifecycle of the AI session bootstrap. */
export type AiChatInitState = 'checking' | 'unavailable' | 'ready' | 'error';

@Injectable()
export class AiChatService {
	private readonly destroyRef = inject(DestroyRef);
	private controller: VanillaChatController | null = null;
	private unsubscribe: (() => void) | null = null;
	private started = false;

	/** Session bootstrap lifecycle. */
	readonly state = signal<AiChatInitState>('checking');
	/** The current transcript. */
	readonly messages = signal<readonly PptxAiUIMessage[]>([]);
	/** The chat status (`ready` / `submitted` / `streaming` / `error`). */
	readonly status = signal<VanillaChatSnapshot['status']>('ready');
	/** The last transport / streaming error, when any. */
	readonly error = signal<Error | undefined>(undefined);
	/** The bootstrap error (SDK missing / session build failed). */
	readonly initError = signal<Error | undefined>(undefined);
	/** The staged, not-yet-applied write proposals. */
	readonly proposals = signal<readonly ProposalView[]>([]);

	/** Whether a request is in flight (drives the composer send/stop toggle). */
	readonly isStreaming = computed(
		() => this.status() === 'submitted' || this.status() === 'streaming',
	);

	constructor() {
		this.destroyRef.onDestroy(() => this.unsubscribe?.());
	}

	/**
	 * Bootstrap the session for the given bridge + config. Idempotent: only the
	 * first call takes effect (the panel calls it once when it opens).
	 */
	init(bridge: PptxAiBridge, config: PptxAiConfig): void {
		if (this.started) {
			return;
		}
		this.started = true;
		this.state.set('checking');
		void (async () => {
			try {
				if (!(await isAiAvailable())) {
					this.state.set('unavailable');
					return;
				}
				const controller = await createVanillaChat({ bridge, config });
				this.controller = controller;
				this.unsubscribe = controller.subscribe((snapshot) => this.applySnapshot(snapshot));
				this.applySnapshot(controller.getSnapshot());
				this.state.set('ready');
			} catch (err) {
				this.initError.set(err instanceof Error ? err : new Error(String(err)));
				this.state.set('error');
			}
		})();
	}

	/** Send a user message (no-op when empty or not ready). */
	send(text: string): void {
		const trimmed = text.trim();
		if (trimmed.length === 0 || !this.controller) {
			return;
		}
		void this.controller.sendMessage(trimmed);
	}

	/** Abort the in-flight request. */
	stop(): void {
		void this.controller?.stop();
	}

	/** Clear the current error and return to the ready state. */
	clearError(): void {
		this.controller?.clearError();
	}

	/** Accept one staged proposal (applies it as one undoable edit). */
	applyProposal(id: string): void {
		this.controller?.proposals.apply(id);
		this.refreshProposals();
	}

	/** Reject one staged proposal without applying it. */
	rejectProposal(id: string): void {
		this.controller?.proposals.revert(id);
		this.refreshProposals();
	}

	/** Accept every staged proposal in order (each its own undoable edit). */
	acceptAllProposals(): void {
		this.controller?.proposals.acceptAll();
		this.refreshProposals();
	}

	private applySnapshot(snapshot: VanillaChatSnapshot): void {
		this.messages.set(snapshot.messages);
		this.status.set(snapshot.status);
		this.error.set(snapshot.error);
		// A tool call in the just-received turn may have staged a proposal.
		this.refreshProposals();
	}

	private refreshProposals(): void {
		this.proposals.set(this.controller?.proposals.list() ?? []);
	}
}
