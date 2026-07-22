/**
 * Tool registry: unifies the MCP-backed document tools ({@link MCP_TOOL_ENTRIES},
 * the exact `pptx-viewer-mcp` functions + schemas run against the live deck) and
 * the viewer-only bespoke tools ({@link BESPOKE_TOOL_ENTRIES}: navigation, deck
 * outline, element/notes readers, table merge) into one name-keyed table, then
 * turns the active subset into an AI SDK `ToolSet`.
 *
 * Two `ToolSet` flavours are produced from the same executors:
 * - schema-only (no `execute`): for `'endpoint'` connections, where the server
 *   owns the model loop and the client runs tools via `onToolCall`.
 * - with `execute`: for `'model'` connections, where an in-process agent runs
 *   the tool loop locally.
 */

import type { ToolSet } from 'ai';
import type { z } from 'zod';

import type { PptxAiBridge } from '../bridge';
import type { AiChangeAnimator } from '../change-animator';
import type { PptxAiConfig, PptxAiToolName } from '../config';
import type { AiSdkModule } from '../loader';
import type { ProposalStore } from '../proposals';
import { BESPOKE_TOOL_ENTRIES } from './bespoke-registry';
import type { AiToolContext } from './executor-base';
import { MCP_TOOL_ENTRIES } from './mcp-registry';
import { runSharedTool } from './shared-tool-runner';

/** An executor pre-bound to its execution context. */
export type BoundExecutor = (input: unknown) => Promise<unknown>;

/** One tool's model-facing schema plus how to run it against the live deck. */
interface UnifiedTool {
	description: string;
	schema: z.ZodTypeAny;
	run: (ctx: AiToolContext, input: unknown) => Promise<unknown> | unknown;
}

/** Build the combined MCP + bespoke tool table (MCP first; bespoke names win). */
function buildAllTools(): Record<string, UnifiedTool> {
	const map: Record<string, UnifiedTool> = {};
	for (const [name, e] of Object.entries(MCP_TOOL_ENTRIES)) {
		map[name] = {
			description: e.description,
			schema: e.schema,
			run: (ctx, input) => runSharedTool(ctx, e.spec, input),
		};
	}
	for (const [name, e] of Object.entries(BESPOKE_TOOL_ENTRIES)) {
		map[name] = { description: e.description, schema: e.schema, run: e.executor };
	}
	return map;
}

const ALL_TOOLS = buildAllTools();

/** Every tool name the assistant knows about (MCP-backed + bespoke). */
export function allToolNames(): PptxAiToolName[] {
	return Object.keys(ALL_TOOLS) as PptxAiToolName[];
}

/** Resolve which tool names are active given the config allow/deny lists. */
export function enabledToolNames(config: PptxAiConfig): PptxAiToolName[] {
	const allowed = config.tools?.enabled ? new Set(config.tools.enabled) : null;
	const denied = new Set(config.tools?.disabled ?? []);
	return allToolNames().filter((name) => (allowed ? allowed.has(name) : true) && !denied.has(name));
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
	animator?: AiChangeAnimator,
): Map<PptxAiToolName, BoundExecutor> {
	const ctx: AiToolContext = {
		bridge,
		proposals,
		writePolicy: config.writePolicy ?? 'stage',
		animator,
	};
	const map = new Map<PptxAiToolName, BoundExecutor>();
	for (const name of enabledToolNames(config)) {
		const tool = ALL_TOOLS[name];
		if (tool) {
			map.set(name, async (input: unknown) => tool.run(ctx, input));
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
		const tool = ALL_TOOLS[name];
		if (!tool) {
			continue;
		}
		const base = { description: tool.description, inputSchema: tool.schema };
		const execute = options.withExecute ? executors.get(name) : undefined;
		tools[name] = execute ? sdk.tool({ ...base, execute }) : sdk.tool(base);
	}
	return { ...tools, ...(config.tools?.extra ?? {}) };
}
