/**
 * Barrel for the AI tool layer: schema definitions, executor context, and the
 * registry that assembles them into an AI SDK `ToolSet`.
 */

export { TOOL_DEFINITIONS } from './schemas';
export type { JsonSchema, ToolDefinition } from './schemas';

export type { AiToolContext, AiToolExecutor, WriteRouteResult } from './executor-base';
export { routeWrite, requireSlide, requireElement } from './executor-base';

export { buildToolExecutors, buildToolSet, enabledToolNames } from './registry';
export type { BoundExecutor } from './registry';
