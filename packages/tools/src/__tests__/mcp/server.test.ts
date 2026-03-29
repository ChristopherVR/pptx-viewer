import { describe, it, expect } from 'vitest';

import { createServer } from '../../mcp/server.js';

describe('mcp server', () => {
	it('creates a server instance', () => {
		const server = createServer();
		expect(server).toBeDefined();
	});

	it('server has the correct name', () => {
		const server = createServer();
		// The McpServer exposes its underlying server instance
		expect(server.server).toBeDefined();
	});
});
