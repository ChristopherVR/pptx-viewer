/**
 * Host-facing configuration types for the framework-agnostic AI assistant, plus
 * {@link resolveChatTransport}, which turns a declarative {@link PptxAiConnection}
 * into a concrete AI SDK `ChatTransport`.
 *
 * All `ai` imports here are type-only; the runtime SDK is threaded in by the
 * caller (see {@link loadAiSdk}) so this module never forces the optional peer
 * to be present.
 */

import type { ChatTransport, LanguageModel, ToolSet, UIMessage } from 'ai';

import type { AiChangeAnimationConfig } from './change-animator';
import type { AiSdkModule } from './loader';

/** The UI message shape exchanged with the assistant. Alias of the SDK type. */
export type PptxAiUIMessage = UIMessage;

/**
 * Canonical name of every tool the assistant can call. Document tools mirror the
 * `pptx-viewer-mcp` server exactly (they ARE the same functions, run against the
 * live deck); the viewer-only tools (navigation, deck outline, element/notes
 * readers, table merge) have no MCP counterpart.
 */
export type PptxAiToolName =
	// ── viewer-only reads (live, model-friendly) ──
	| 'get_deck_overview'
	| 'get_slide'
	| 'get_element'
	| 'get_speaker_notes'
	| 'find_text'
	| 'get_theme'
	// ── viewer-only navigation + convenience ──
	| 'go_to_slide'
	| 'select_elements'
	| 'merge_tables'
	// ── MCP reads (no bespoke equivalent) ──
	| 'get_metadata'
	| 'get_layouts'
	| 'find_placeholders'
	| 'get_presentation_properties'
	| 'run_accessibility_check'
	| 'convert_to_markdown'
	// ── MCP element editing ──
	| 'add_element'
	| 'update_element'
	| 'delete_elements'
	| 'arrange_elements'
	| 'clone_element'
	| 'set_element_animation'
	| 'group_elements'
	| 'ungroup_elements'
	| 'batch_update_elements'
	| 'update_element_style'
	| 'replace_geometry'
	| 'set_element_lock'
	| 'manage_hyperlinks'
	// ── MCP text / tables / charts / smartart ──
	| 'replace_text'
	| 'manage_comments'
	| 'update_table_cells'
	| 'manage_table_structure'
	| 'create_chart'
	| 'update_chart'
	| 'add_chart_series'
	| 'remove_chart_series'
	| 'update_chart_series_data'
	| 'manage_smart_art'
	| 'apply_template'
	// ── MCP slide structure ──
	| 'add_slide'
	| 'duplicate_slide'
	| 'delete_slides'
	| 'reorder_slides'
	| 'update_slide_properties'
	| 'set_slide_transition'
	// ── MCP theme editing (applied immediately) ──
	| 'apply_theme_preset'
	| 'update_theme_colors'
	| 'update_theme_fonts'
	// ── MCP presentation-level (needs applyDeckData) ──
	| 'set_canvas_size'
	| 'update_metadata'
	| 'manage_sections'
	| 'update_presentation_properties'
	| 'apply_layout';

type Resolvable<T> = T | (() => T | Promise<T>);

/** How the assistant reaches a language model. */
export type PptxAiConnection =
	/**
	 * Post messages to a host backend route (recommended for production so the
	 * provider API key stays server-side). Maps to `DefaultChatTransport`.
	 */
	| {
			kind: 'endpoint';
			api: string;
			headers?: Resolvable<Record<string, string>>;
			body?: Resolvable<Record<string, unknown>>;
			credentials?: RequestCredentials;
			fetch?: typeof globalThis.fetch;
	  }
	/**
	 * Run a language model in-process in the browser (bring-your-own key /
	 * local model). Maps to a `ToolLoopAgent` behind a `DirectChatTransport`.
	 */
	| { kind: 'model'; model: LanguageModel; system?: string; maxSteps?: number }
	/** Provide a fully-constructed transport (advanced / testing escape hatch). */
	| { kind: 'transport'; transport: ChatTransport<PptxAiUIMessage> };

/** How writes proposed by the assistant reach the document. */
export type PptxAiWritePolicy = 'stage' | 'approve' | 'auto';

/** Which deck context is fed to the model with each turn. */
export type PptxAiContextStrategy = 'outline' | 'current-slide' | 'none';

/** Optional per-session history persistence hooks. */
export interface PptxAiHistoryHooks {
	load?(id: string): Promise<PptxAiUIMessage[]>;
	save?(id: string, messages: PptxAiUIMessage[]): Promise<void>;
}

/** Complete host configuration for an AI chat session. */
export interface PptxAiConfig {
	connection: PptxAiConnection;
	/** Extra host instructions appended to the base system prompt. */
	systemPromptExtras?: string;
	tools?: {
		/** Allowlist. When set, only these tools are exposed. */
		enabled?: PptxAiToolName[];
		/** Denylist, applied after `enabled`. */
		disabled?: PptxAiToolName[];
		/** Additional host-defined tools merged into the tool set. */
		extra?: ToolSet;
	};
	/** Default `'stage'`. */
	writePolicy?: PptxAiWritePolicy;
	/** Default `'outline'`. */
	contextStrategy?: PptxAiContextStrategy;
	history?: PptxAiHistoryHooks;
	/**
	 * How AI edits are animated on the canvas so the user can watch them land
	 * (glide old->new, fade/scale in-out, glow-pulse). Omit for the defaults;
	 * set `{ enabled: false }` to turn it off.
	 */
	changeAnimation?: AiChangeAnimationConfig;
	onError?(error: Error): void;
}

/** Options threaded into {@link resolveChatTransport} by the session builder. */
export interface ResolveTransportOptions {
	/** The loaded AI SDK module. */
	sdk: AiSdkModule;
	connection: PptxAiConnection;
	/**
	 * Tool set WITH `execute` implementations, used only by the in-process
	 * `'model'` connection so the agent's tool loop can run locally.
	 */
	toolsWithExecute?: ToolSet;
	/** System prompt for the `'model'` connection's agent. */
	system?: string;
	/** Max agent tool-loop steps for the `'model'` connection. Default `16`. */
	maxSteps?: number;
}

/**
 * Resolve a {@link PptxAiConnection} into a concrete AI SDK `ChatTransport`.
 *
 * @throws Error when a `'model'` connection is requested but no
 *   `toolsWithExecute` set was supplied.
 */
export function resolveChatTransport(
	options: ResolveTransportOptions,
): ChatTransport<PptxAiUIMessage> {
	const { sdk, connection } = options;

	switch (connection.kind) {
		case 'endpoint': {
			return new sdk.DefaultChatTransport<PptxAiUIMessage>({
				api: connection.api,
				headers: connection.headers,
				body: connection.body,
				credentials: connection.credentials,
				fetch: connection.fetch,
			});
		}
		case 'model': {
			const agent = new sdk.ToolLoopAgent({
				model: connection.model,
				instructions: options.system ?? connection.system,
				tools: options.toolsWithExecute ?? {},
				stopWhen: sdk.stepCountIs(connection.maxSteps ?? options.maxSteps ?? 16),
			});
			return new sdk.DirectChatTransport({
				agent,
			}) as unknown as ChatTransport<PptxAiUIMessage>;
		}
		case 'transport': {
			return connection.transport;
		}
		default: {
			const exhaustive: never = connection;
			throw new Error(`Unknown AI connection kind: ${JSON.stringify(exhaustive)}`);
		}
	}
}
