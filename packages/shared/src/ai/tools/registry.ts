/**
 * Tool registry: assembles the per-name executor map (bound to a bridge +
 * proposal store + write policy) and turns it into an AI SDK `ToolSet`.
 *
 * Two `ToolSet` flavours are produced from the same executors:
 * - schema-only (no `execute`): for `'endpoint'` connections, where the server
 *   owns the model loop and the client runs tools via `onToolCall`.
 * - with `execute`: for `'model'` connections, where an in-process
 *   `ToolLoopAgent` runs the tool loop locally.
 */

import type { ToolSet } from 'ai';

import type { PptxAiBridge } from '../bridge';
import type { PptxAiConfig, PptxAiToolName } from '../config';
import type { AiSdkModule } from '../loader';
import type { ProposalStore } from '../proposals';
import { editDataExecutors } from './edit-data-tools';
import { editExecutors } from './edit-tools';
import type { AiToolContext, AiToolExecutor } from './executor-base';
import { navExecutors } from './nav-tools';
import { readExecutors } from './read-tools';
import { TOOL_DEFINITIONS } from './schemas';
import { slideExecutors } from './slide-tools';
import { themeExecutors } from './theme-tools';

/** All executors, keyed by canonical tool name. */
const ALL_EXECUTORS: Record<string, AiToolExecutor> = {
	...readExecutors,
	...navExecutors,
	...editExecutors,
	...editDataExecutors,
	...slideExecutors,
	...themeExecutors,
};

/** An executor pre-bound to its execution context. */
export type BoundExecutor = (input: unknown) => Promise<unknown>;

/** Resolve which tool names are active given the config allow/deny lists. */
export function enabledToolNames(config: PptxAiConfig): PptxAiToolName[] {
	const all = Object.keys(TOOL_DEFINITIONS) as PptxAiToolName[];
	const allowed = config.tools?.enabled ? new Set(config.tools.enabled) : null;
	const denied = new Set(config.tools?.disabled ?? []);
	return all.filter((name) => (allowed ? allowed.has(name) : true) && !denied.has(name));
}

/**
 * Build the map of active tool executors, each bound to `{ bridge, proposals,
 * writePolicy }`. Used by `onToolCall` (endpoint mode) and by the with-execute
 * tool set (model mode).
 */
export function buildToolExecutors(
	bridge: PptxAiBridge,
	proposals: ProposalStore,
	config: PptxAiConfig,
): Map<PptxAiToolName, BoundExecutor> {
	const ctx: AiToolContext = {
		bridge,
		proposals,
		writePolicy: config.writePolicy ?? 'stage',
	};
	const map = new Map<PptxAiToolName, BoundExecutor>();
	for (const name of enabledToolNames(config)) {
		const executor = ALL_EXECUTORS[name];
		if (executor) {
			map.set(name, async (input: unknown) => executor(ctx, input));
		}
	}
	return map;
}

/**
 * Build an AI SDK `ToolSet` for the active tools. When `withExecute` is true,
 * each tool's `execute` dispatches to the bound executor (model mode); when
 * false, the tools are schema-only (endpoint mode). Host `extra` tools are
 * merged last and win on name collisions.
 */
export function buildToolSet(
	sdk: AiSdkModule,
	config: PptxAiConfig,
	executors: Map<PptxAiToolName, BoundExecutor>,
	options: { withExecute: boolean },
): ToolSet {
	const tools: ToolSet = {};
	for (const name of enabledToolNames(config)) {
		const def = TOOL_DEFINITIONS[name];
		const inputSchema = sdk.jsonSchema(def.inputSchema as Parameters<AiSdkModule['jsonSchema']>[0]);
		const execute = options.withExecute ? executors.get(name) : undefined;
		tools[name] = sdk.tool(
			execute
				? { description: def.description, inputSchema, execute }
				: { description: def.description, inputSchema },
		);
	}
	return { ...tools, ...(config.tools?.extra ?? {}) };
}
