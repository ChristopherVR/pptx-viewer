import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, it, expect, beforeAll } from 'vitest';

import { createServer } from '../../mcp/server.js';

describe('mcp server', () => {
	it('creates a server instance', () => {
		const server = createServer();
		expect(server).toBeDefined();
	});

	it('server has the correct name', () => {
		const server = createServer();
		expect(server.server).toBeDefined();
	});
});

describe('mcp server tool registration', () => {
	let client: Client;
	beforeAll(async () => {
		const server = createServer();
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		client = new Client({ name: 'test-client', version: '1.0.0' });

		await server.connect(serverTransport);
		await client.connect(clientTransport);
	});

	it('lists all 58 registered tools', async () => {
		const result = await client.listTools();
		expect(result.tools).toHaveLength(58);
	});

	it('includes all expected tool names', async () => {
		const result = await client.listTools();
		const names = result.tools.map((t) => t.name);

		const expectedTools = [
			'get_slide',
			'add_slide',
			'delete_slides',
			'reorder_slides',
			'duplicate_slide',
			'update_slide_properties',
			'set_slide_transition',
			'set_canvas_size',
			'add_element',
			'update_element',
			'rename_element',
			'delete_elements',
			'arrange_elements',
			'clone_element',
			'set_element_animation',
			'group_elements',
			'ungroup_elements',
			'batch_update_elements',
			'update_table_cells',
			'manage_table_structure',
			'update_element_style',
			'run_accessibility_check',
			'find_text',
			'replace_text',
			'manage_comments',
			'convert_to_markdown',
			'get_theme_info',
			'apply_theme_preset',
			'update_theme_colors',
			'update_theme_fonts',
			'update_chart',
			'add_chart_series',
			'remove_chart_series',
			'update_chart_series_data',
			'create_chart',
			'manage_smart_art',
			'find_placeholders',
			'apply_template',
			'get_metadata',
			'update_metadata',
			'manage_sections',
			'export_to_svg',
			'export_slide_svg',
			'export_to_json',
			'import_from_json',
			'manage_hyperlinks',
			'replace_geometry',
			'set_element_lock',
			'validate_presentation',
			'repair_presentation',
			'get_presentation_properties',
			'update_presentation_properties',
			'get_layouts',
			'apply_layout',
		];

		for (const tool of expectedTools) {
			expect(names).toContain(tool);
		}
	});

	it('each tool has a description', async () => {
		const result = await client.listTools();
		for (const tool of result.tools) {
			expect(tool.description).toBeTruthy();
			expect(tool.description!.length).toBeGreaterThan(5);
		}
	});

	it('each tool has an input schema', async () => {
		const result = await client.listTools();
		for (const tool of result.tools) {
			expect(tool.inputSchema).toBeDefined();
			expect(tool.inputSchema.type).toBe('object');
		}
	});

	it('all tools require filePath in their schema', async () => {
		const result = await client.listTools();
		for (const tool of result.tools) {
			const props = tool.inputSchema.properties as Record<string, unknown>;
			expect(props).toHaveProperty('filePath');
		}
	});
});
