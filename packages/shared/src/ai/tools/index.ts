/**
 * Barrel for the AI tool layer: the execution context, the MCP-backed and
 * viewer-only tool registries, the live-deck tool runner, and the assembler
 * that turns them into an AI SDK `ToolSet`.
 */

export type { AiToolContext, AiToolExecutor, WriteRouteResult } from './executor-base';
export { routeWrite, requireSlide, requireElement } from './executor-base';

export { allToolNames, buildToolExecutors, buildToolSet, enabledToolNames } from './registry';
export type { BoundExecutor } from './registry';

export { MCP_TOOL_ENTRIES } from './mcp-registry';
export type { McpToolEntry, McpToolName } from './mcp-registry';

export { BESPOKE_TOOL_ENTRIES } from './bespoke-registry';
export type { BespokeToolEntry, BespokeToolName } from './bespoke-registry';

export { runSharedTool } from './shared-tool-runner';
export type { SharedToolCommit, SharedToolFn, SharedToolSpec } from './shared-tool-runner';
