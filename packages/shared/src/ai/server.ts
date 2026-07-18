/**
 * Backend helpers a host imports into its own chat route (for `'endpoint'`
 * connections). The route runs the model server-side; tools are schema-only so
 * the model's tool calls are forwarded to the browser, executed against the
 * live deck there, and streamed back - keeping the provider key off the client.
 *
 * `ai` is loaded lazily so this module stays importable without the peer, even
 * though a real backend route will always have `ai` installed.
 */

import type { ToolSet } from 'ai';

import type { PptxAiConfig, PptxAiWritePolicy } from './config';
import { loadAiSdk } from './loader';
import { buildSystemPrompt } from './system-prompt';
import { buildToolSet, enabledToolNames } from './tools';

/**
 * Build a schema-only tool set for a backend chat route. The tools carry no
 * `execute` implementation, so the model's tool calls are returned to the
 * client for execution against the live document.
 *
 * @throws Error when the optional `ai` SDK is not installed.
 */
export async function buildPptxAiTools(config: Pick<PptxAiConfig, 'tools'> = {}): Promise<ToolSet> {
	const sdk = await loadAiSdk();
	if (!sdk) {
		throw new Error('The optional "ai" SDK is not installed on the server.');
	}
	return buildToolSet(sdk, config as PptxAiConfig, new Map(), { withExecute: false });
}

/**
 * Build the assistant system prompt for a backend chat route. Mirrors the
 * prompt the client would compose, so server- and client-driven sessions share
 * identical instructions.
 */
export function buildPptxAiSystemPrompt(
	options: {
		writePolicy?: PptxAiWritePolicy;
		extras?: string;
	} = {},
): string {
	return buildSystemPrompt(options);
}

/** Names of the tools a route would expose, honouring allow/deny lists. */
export { enabledToolNames };
