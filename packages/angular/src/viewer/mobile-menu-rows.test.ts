import { describe, expect, it, vi } from 'vitest';

import { buildMobileMenuRows } from './mobile-menu-rows';
import type { MobileMenuRowActions } from './mobile-menu-rows';

function noopActions(): MobileMenuRowActions {
	return {
		insertText: vi.fn(),
		openFind: vi.fn(),
		openSorter: vi.fn(),
		toggleNotes: vi.fn(),
		present: vi.fn(),
		exportPng: vi.fn(),
		exportPdf: vi.fn(),
		exportGif: vi.fn(),
		exportVideo: vi.fn(),
		openFile: vi.fn(),
		savePptx: vi.fn(),
		print: vi.fn(),
	};
}

describe('buildMobileMenuRows', () => {
	it('includes the notes and export rows when hiddenActions is omitted (backward-compatible default)', () => {
		const rows = buildMobileMenuRows(
			{
				slideCount: 3,
				exporting: false,
				showNotes: false,
				canEdit: true,
				hiddenActions: undefined,
			},
			noopActions(),
		);
		const keys = rows.map((row) => row.key);
		expect(keys).toContain('notes');
		expect(keys).toStrictEqual(
			expect.arrayContaining(['export-png', 'export-pdf', 'export-gif', 'export-video']),
		);
	});

	it('drops the notes row when "notes" is hidden', () => {
		const rows = buildMobileMenuRows(
			{
				slideCount: 3,
				exporting: false,
				showNotes: false,
				canEdit: true,
				hiddenActions: ['notes'],
			},
			noopActions(),
		);
		expect(rows.find((row) => row.key === 'notes')).toBeUndefined();
		// Unrelated rows stay.
		expect(rows.find((row) => row.key === 'find')).toBeDefined();
	});

	it('drops all four export rows when "export" is hidden', () => {
		const rows = buildMobileMenuRows(
			{
				slideCount: 3,
				exporting: false,
				showNotes: false,
				canEdit: true,
				hiddenActions: ['export'],
			},
			noopActions(),
		);
		const keys = rows.map((row) => row.key);
		expect(keys).not.toContain('export-png');
		expect(keys).not.toContain('export-pdf');
		expect(keys).not.toContain('export-gif');
		expect(keys).not.toContain('export-video');
		// save-pptx is a distinct action id and stays.
		expect(keys).toContain('save-pptx');
	});

	it('omits the insert-text row entirely when not editable, independent of hiddenActions', () => {
		const rows = buildMobileMenuRows(
			{ slideCount: 3, exporting: false, showNotes: false, canEdit: false, hiddenActions: [] },
			noopActions(),
		);
		expect(rows.find((row) => row.key === 'insert-text')).toBeUndefined();
	});
});
