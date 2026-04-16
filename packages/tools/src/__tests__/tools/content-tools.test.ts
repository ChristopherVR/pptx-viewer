import type { PptxData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { findText, replaceText, manageComments } from '../../tools/content-tools.js';
import type { ToolContext } from '../../types.js';

function makeTestPresentation(): PptxData {
	return {
		width: 960,
		height: 540,
		slides: [
			{
				id: 'slide-0',
				rId: 'rId2',
				slideNumber: 1,
				elements: [
					{
						id: 'el-0',
						type: 'text' as const,
						x: 100,
						y: 100,
						width: 300,
						height: 60,
						text: 'Hello World foo',
					},
					{
						id: 'el-1',
						type: 'text' as const,
						x: 100,
						y: 200,
						width: 300,
						height: 60,
						text: 'Another FOO line',
					},
					{
						id: 'tbl-0',
						type: 'table' as const,
						x: 50,
						y: 300,
						width: 400,
						height: 120,
						tableData: {
							rows: [
								{ cells: [{ text: 'Header foo' }, { text: 'Header bar' }] },
								{ cells: [{ text: 'Cell A' }, { text: 'Cell B' }] },
							],
							columnWidths: [0.5, 0.5],
						},
					},
				],
				notes: 'Speaker note foo',
				comments: [
					{
						id: 'c1',
						text: 'First comment',
						author: 'Alice',
						resolved: false,
					},
					{
						id: 'c2',
						text: 'Resolved comment',
						author: 'Bob',
						resolved: true,
					},
				],
			},
			{
				id: 'slide-1',
				rId: 'rId3',
				slideNumber: 2,
				elements: [
					{
						id: 'el-10',
						type: 'text' as const,
						x: 100,
						y: 100,
						width: 300,
						height: 60,
						text: 'Slide two content',
					},
				],
				notes: '',
				comments: [],
			},
		],
	} as unknown as PptxData;
}

function ctx(pptxData?: PptxData): ToolContext {
	return { pptxData: pptxData ?? makeTestPresentation() };
}

// ── findText ──────────────────────────────────────────────────────────────────

describe('findText', () => {
	it('finds text across all slides (case-insensitive by default)', () => {
		const result = findText(ctx(), { query: 'foo' });
		expect(result.dirty).toBe(false);
		// should find in el-0 text, el-1 text, table cell, and notes
		expect(result.result.matchCount).toBeGreaterThanOrEqual(4);
	});

	it('is case-sensitive when requested', () => {
		const result = findText(ctx(), { query: 'foo', caseSensitive: true });
		// 'FOO' in el-1 and 'Header foo' and notes 'foo' and el-0 'foo'
		const upperMatches = result.result.matches.filter((m) => m.matchedText === 'FOO');
		expect(upperMatches).toHaveLength(0); // exact 'foo' only
		// should still find 'foo' occurrences
		expect(result.result.matchCount).toBeGreaterThan(0);
	});

	it('restricts search to specified slideIndexes', () => {
		const result = findText(ctx(), { query: 'foo', slideIndexes: [1] });
		// slide-1 has no 'foo' text
		expect(result.result.matchCount).toBe(0);
	});

	it('uses regex when useRegex=true', () => {
		const result = findText(ctx(), { query: 'foo|bar', useRegex: true });
		expect(result.result.matchCount).toBeGreaterThan(0);
	});

	it('returns context snippets', () => {
		const result = findText(ctx(), { query: 'Hello' });
		expect(result.result.matches.length).toBeGreaterThan(0);
		expect(result.result.matches[0].context).toContain('Hello');
	});

	it('throws on invalid slideIndex', () => {
		expect(() => findText(ctx(), { query: 'foo', slideIndexes: [99] })).toThrow('out of range');
	});
});

// ── replaceText ───────────────────────────────────────────────────────────────

describe('replaceText', () => {
	it('replaces text in elements', () => {
		const c = ctx();
		const result = replaceText(c, { query: 'Hello World', replacement: 'Goodbye' });
		expect(result.dirty).toBe(true);
		expect(result.result.replacementCount).toBeGreaterThan(0);
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'el-0');
		expect((el as { text?: string }).text).toContain('Goodbye');
	});

	it('replaces with regex', () => {
		const c = ctx();
		const result = replaceText(c, {
			query: 'foo',
			replacement: 'BAR',
			useRegex: true,
		});
		expect(result.result.replacementCount).toBeGreaterThan(0);
	});

	it('returns dirty=false when no replacements', () => {
		const result = replaceText(ctx(), { query: 'nonexistent_xyz', replacement: 'something' });
		expect(result.dirty).toBe(false);
		expect(result.result.replacementCount).toBe(0);
	});

	it('replaces in table cells', () => {
		const c = ctx();
		replaceText(c, { query: 'Header foo', replacement: 'Header UPDATED' });
		const tbl = c.pptxData.slides[0].elements.find((e) => e.id === 'tbl-0');
		const tableEl = tbl as { tableData?: { rows: Array<{ cells: Array<{ text: string }> }> } };
		expect(tableEl.tableData?.rows[0].cells[0].text).toBe('Header UPDATED');
	});

	it('replaces in notes', () => {
		const c = ctx();
		replaceText(c, { query: 'Speaker note foo', replacement: 'Speaker note BAR' });
		expect(c.pptxData.slides[0].notes).toBe('Speaker note BAR');
	});
});

// ── manageComments ────────────────────────────────────────────────────────────

describe('manageComments', () => {
	it('lists comments (excludes resolved by default)', () => {
		const result = manageComments(ctx(), { action: 'list' });
		expect(result.dirty).toBe(false);
		expect(result.result.comments).toBeDefined();
		// only unresolved by default
		const resolved = result.result.comments?.filter((c) => c.resolved);
		expect(resolved).toHaveLength(0);
	});

	it('lists all comments when includeResolved=true', () => {
		const result = manageComments(ctx(), { action: 'list', includeResolved: true });
		expect(result.result.count).toBe(2);
	});

	it('lists comments for a specific slide', () => {
		const result = manageComments(ctx(), {
			action: 'list',
			slideIndex: 0,
			includeResolved: true,
		});
		expect(result.result.count).toBe(2);
	});

	it('adds a new comment', () => {
		const c = ctx();
		const result = manageComments(c, {
			action: 'add',
			slideIndex: 0,
			text: 'New comment from test',
			author: 'Tester',
		});
		expect(result.dirty).toBe(true);
		expect(result.result.commentId).toBe(true);
		const found = c.pptxData.slides[0].comments?.find((cm) => cm.id === result.result.commentId);
		expect(found?.text).toBe('New comment from test');
		expect(found?.author).toBe('Tester');
	});

	it('deletes a comment', () => {
		const c = ctx();
		const result = manageComments(c, { action: 'delete', commentId: 'c1' });
		expect(result.dirty).toBe(true);
		expect(c.pptxData.slides[0].comments?.find((cm) => cm.id === 'c1')).toBeUndefined();
	});

	it('resolves a comment', () => {
		const c = ctx();
		manageComments(c, { action: 'resolve', commentId: 'c1' });
		const found = c.pptxData.slides[0].comments?.find((cm) => cm.id === 'c1');
		expect(found?.resolved).toBe(true);
	});

	it('throws when adding without slideIndex', () => {
		expect(() => manageComments(ctx(), { action: 'add', text: 'test' })).toThrow('slideIndex');
	});

	it('throws when deleting nonexistent comment', () => {
		expect(() => manageComments(ctx(), { action: 'delete', commentId: 'nonexistent' })).toThrow(
			'not found',
		);
	});
});
