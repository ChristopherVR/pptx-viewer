import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { expect, it } from 'vitest';

import { registerTools } from '../../mcp/index.js';
import { createTestPptxBytes } from '../helpers/create-test-pptx.js';

it('the importable MCP entry registers tools and honors a composed server root', async () => {
	const rootDir = await mkdtemp(join(tmpdir(), 'pptx-composed-'));
	const server = new McpServer({ name: 'combined-test', version: '1.0.0' });
	const client = new Client({ name: 'test-client', version: '1.0.0' });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	try {
		await writeFile(join(rootDir, 'test.pptx'), await createTestPptxBytes(1));
		registerTools(server, { rootDir });
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		const result = await client.callTool({
			name: 'get_slide',
			arguments: { filePath: 'test.pptx', slideIndex: 0 },
		});
		expect(result.isError).not.toBe(true);
		expect(result.content).toEqual([
			expect.objectContaining({ type: 'text', text: expect.stringContaining('Slide 1 Title') }),
		]);
	} finally {
		await client.close();
		await server.close();
		await rm(rootDir, { recursive: true, force: true });
	}
});
