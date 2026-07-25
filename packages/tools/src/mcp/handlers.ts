import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';

import { executeToolWithContext } from '../execution.js';
import type { ExecutionContext, ToolContext, ToolResult } from '../types.js';

const ALLOWED_EXTENSIONS = new Set(['.pptx', '.ppt']);

/**
 * Resolve `dir` against `rootDir` and ensure the result stays within it.
 *
 * `rootDir` defaults to `process.env.PPTX_TOOLS_ROOT` if set, else
 * `process.cwd()`. Throws on traversal escape or non-string input. Node-only:
 * this lives here (rather than beside the tool it guards) so the tool modules
 * stay free of `node:path` and remain bundleable for the browser.
 */
export function resolveScopedDir(dir: string, rootDir?: string): string {
	if (typeof dir !== 'string' || dir.length === 0) {
		throw new Error('MCP tool: path must be a non-empty string');
	}

	const root = resolve(rootDir ?? process.env['PPTX_TOOLS_ROOT'] ?? process.cwd());
	const resolved = isAbsolute(dir) ? resolve(dir) : resolve(root, dir);

	const rootWithSep = root.endsWith(sep) ? root : root + sep;
	if (resolved !== root && !resolved.startsWith(rootWithSep)) {
		throw new Error(`MCP tool: path "${dir}" resolves outside the allowed root "${root}"`);
	}

	return resolved;
}

/**
 * Resolve `filePath` against `rootDir` and ensure the result stays within it.
 *
 * - `rootDir` defaults to `process.env.PPTX_TOOLS_ROOT` if set, else `process.cwd()`.
 * - The path must end in `.pptx` or `.ppt` (case-insensitive).
 * - Throws on traversal escape, non-string inputs, or disallowed extensions.
 */
export function resolveScopedFilePath(filePath: string, rootDir?: string): string {
	if (typeof filePath !== 'string' || filePath.length === 0) {
		throw new Error('MCP tool: filePath must be a non-empty string');
	}

	const resolved = resolveScopedDir(filePath, rootDir);

	const lower = resolved.toLowerCase();
	let isAllowed = false;
	for (const ext of ALLOWED_EXTENSIONS) {
		if (lower.endsWith(ext)) {
			isAllowed = true;
			break;
		}
	}
	if (!isAllowed) {
		throw new Error(
			`MCP tool: filePath "${filePath}" must end with one of: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
		);
	}

	return resolved;
}

/** Node.js filesystem provider for the MCP server. */
const nodeFs = {
	readFile: async (path: string) => new Uint8Array(await readFile(path)),
	writeFile: async (path: string, data: Uint8Array) => {
		await writeFile(path, data);
	},
};

/** Optional configuration for the MCP context. */
export interface McpContextOptions {
	/**
	 * Root directory under which all `filePath` arguments are scoped.
	 * Defaults to `process.env.PPTX_TOOLS_ROOT` if set, else `process.cwd()`.
	 */
	rootDir?: string;
}

/** Create an ExecutionContext for MCP (no collaboration, no viewer). */
export function createMcpContext(_options?: McpContextOptions): ExecutionContext {
	return { filesystem: nodeFs };
}

/**
 * Run a tool via MCP, using the shared collaboration-aware execution pipeline.
 * Returns the inner result value (not the full ToolResult wrapper).
 *
 * `filePath` is validated and resolved against the configured rootDir
 * (env `PPTX_TOOLS_ROOT` or process.cwd()) before being handed to the
 * filesystem provider.
 */
export async function runMcpTool<T>(
	filePath: string,
	fn: (ctx: ToolContext) => ToolResult<T> | Promise<ToolResult<T>>,
	options?: McpContextOptions,
): Promise<T> {
	const safePath = resolveScopedFilePath(filePath, options?.rootDir);
	const ctx = createMcpContext(options);
	return executeToolWithContext(safePath, ctx, fn);
}
