import { readFile, writeFile } from 'node:fs/promises';

import { executeToolWithContext } from '../execution.js';
import type { ExecutionContext, ToolContext, ToolResult } from '../types.js';

/** Node.js filesystem provider for the MCP server. */
const nodeFs = {
	readFile: async (path: string) => new Uint8Array(await readFile(path)),
	writeFile: async (path: string, data: Uint8Array) => {
		await writeFile(path, data);
	},
};

/** Create an ExecutionContext for MCP (no collaboration, no viewer). */
export function createMcpContext(): ExecutionContext {
	return { filesystem: nodeFs };
}

/**
 * Run a tool via MCP — uses the shared collaboration-aware execution pipeline.
 * Returns the inner result value (not the full ToolResult wrapper).
 */
export async function runMcpTool<T>(
	filePath: string,
	fn: (ctx: ToolContext) => ToolResult<T> | Promise<ToolResult<T>>,
): Promise<T> {
	const ctx = createMcpContext();
	return executeToolWithContext(filePath, ctx, fn);
}

/**
 * @deprecated Use runMcpTool instead.
 */
export { runMcpTool as runMutatingTool };
