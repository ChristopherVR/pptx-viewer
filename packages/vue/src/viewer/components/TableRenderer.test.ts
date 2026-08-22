import { mount } from '@vue/test-utils';
import type {
	ParsedTableStyleEntry,
	ParsedTableStyleMap,
	PptxElement,
	PptxTableCell,
	PptxTableData,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
import type { CellTextRun } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { TableCellEditContext } from '../composables/table-edit';
import { TableCellEditKey } from '../composables/table-edit';
import type { TableSelectionContext, TableSelectionState } from '../composables/table-selection';
import { TableSelectionKey } from '../composables/table-selection';
import { TableThemeKey } from '../composables/table-theme';
import TableRenderer from './TableRenderer.vue';

/** Mount with both edit + selection contexts so cell selection is active. */
function mountSelectable(tableData: PptxTableData): {
	wrapper: ReturnType<typeof mount>;
	selection: TableSelectionContext['selection'];
} {
	const selectionRef = ref<TableSelectionState | null>(null);
	const editCtx: TableCellEditContext = { canEdit: () => true, commit: vi.fn() };
	const selCtx: TableSelectionContext = {
		selection: selectionRef,
		select: (next) => {
			selectionRef.value = next;
		},
		resizeColumns: vi.fn(),
		resizeRow: vi.fn(),
	};
	const wrapper = mount(TableRenderer, {
		props: { element: table(tableData), zIndex: 0 },
		global: {
			provide: {
				[TableCellEditKey as symbol]: editCtx,
				[TableSelectionKey as symbol]: selCtx,
			},
		},
	});
	return { wrapper, selection: selectionRef };
}

/** Mount with an injected cell-edit context (commit spy + canEdit gate). */
function mountEditable(
	tableData: PptxTableData,
	opts: { canEdit?: boolean } = {},
): { wrapper: ReturnType<typeof mount>; commit: ReturnType<typeof vi.fn> } {
	const commit = vi.fn();
	const ctx: TableCellEditContext = {
		canEdit: () => opts.canEdit ?? true,
		commit,
	};
	const wrapper = mount(TableRenderer, {
		props: { element: table(tableData), zIndex: 0 },
		global: { provide: { [TableCellEditKey as symbol]: ctx } },
	});
	return { wrapper, commit };
}

function table(tableData: PptxTableData, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'table',
		id: 'tbl 1',
		x: 50,
		y: 200,
		width: 400,
		height: 200,
		tableData,
		...overrides,
	} as PptxElement;
}

/** Cast a cell with extra `textRuns` field through the `PptxTableCell` type. */
function richCell(base: PptxTableCell, textRuns: CellTextRun[]): PptxTableCell {
	return { ...base, textRuns } as PptxTableCell & { textRuns: CellTextRun[] };
}

const basicGrid: PptxTableData = {
	columnWidths: [0.5, 0.5],
	rows: [{ cells: [{ text: 'A1' }, { text: 'B1' }] }, { cells: [{ text: 'A2' }, { text: 'B2' }] }],
};

describe('tableRenderer', () => {
	it('renders a positioned wrapper with the table grid', () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 7 } });
		const root = wrapper.get('[data-element-id="tbl 1"]');
		expect(root.attributes('style')).toContain('left: 50px');
		expect(root.attributes('style')).toContain('top: 200px');
		expect(root.attributes('style')).toContain('z-index: 7');
		expect(wrapper.find('table').exists()).toBeTruthy();
	});

	it('declares the shared default font family on the table root', () => {
		// Without it an unstyled cell inherits the HOST chrome's font stack, and
		// the same deck measured different type metrics in every binding.
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 0 } });
		expect(wrapper.get('table').attributes('style')).toContain('Segoe UI');
	});

	it('renders the right number of rows and cells for a basic grid', () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 0 } });
		expect(wrapper.findAll('tr')).toHaveLength(2);
		expect(wrapper.findAll('td')).toHaveLength(4);
	});

	it('emits a colgroup with proportional column widths', () => {
		const wrapper = mount(TableRenderer, {
			props: { element: table({ ...basicGrid, columnWidths: [0.7, 0.3] }), zIndex: 0 },
		});
		const cols = wrapper.findAll('col');
		expect(cols).toHaveLength(2);
		expect(cols[0].attributes('style')).toContain('width: 70.00%');
		expect(cols[1].attributes('style')).toContain('width: 30.00%');
	});

	it('renders cell text content', () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 0 } });
		const texts = wrapper.findAll('td').map((td) => td.text());
		expect(texts).toStrictEqual(['A1', 'B1', 'A2', 'B2']);
	});

	it('applies a horizontal merge as colspan and skips the absorbed cell', () => {
		const merged: PptxTableData = {
			columnWidths: [0.5, 0.5],
			rows: [
				{
					cells: [
						{ text: 'Spans both', gridSpan: 2 },
						{ text: '', hMerge: true },
					],
				},
				{ cells: [{ text: 'A2' }, { text: 'B2' }] },
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(merged), zIndex: 0 } });
		const firstRowCells = wrapper.findAll('tr')[0].findAll('td');
		// The hMerge continuation cell is not rendered.
		expect(firstRowCells).toHaveLength(1);
		expect(firstRowCells[0].attributes('colspan')).toBe('2');
		expect(firstRowCells[0].text()).toBe('Spans both');
	});

	it('applies a vertical merge as rowspan and skips the absorbed cell', () => {
		const merged: PptxTableData = {
			columnWidths: [0.5, 0.5],
			rows: [
				{ cells: [{ text: 'Tall', rowSpan: 2 }, { text: 'B1' }] },
				{ cells: [{ text: '', vMerge: true }, { text: 'B2' }] },
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(merged), zIndex: 0 } });
		const rows = wrapper.findAll('tr');
		expect(rows[0].findAll('td')[0].attributes('rowspan')).toBe('2');
		// Second row only renders its single non-merged cell.
		expect(rows[1].findAll('td')).toHaveLength(1);
		expect(rows[1].findAll('td')[0].text()).toBe('B2');
	});

	it('applies an explicit cell fill colour', () => {
		const filled: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Filled', style: { backgroundColor: '#ff0000' } }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(filled), zIndex: 0 } });
		const cell = wrapper.get('td');
		expect(cell.attributes('style')).toContain('background-color: #ff0000');
	});

	it('defaults body-cell text to the dark slide colour when none is set', () => {
		// Without this fallback an unstyled cell inherits the dark-UI chrome
		// `foreground` (near-white) and is invisible on a light table.
		const plain: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Body' }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(plain), zIndex: 0 } });
		expect(wrapper.get('td').attributes('style')).toContain('color: #111827');
	});

	it('lets an explicit cell colour win over the default', () => {
		const coloured: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Body', style: { color: '#ff0000' } }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(coloured), zIndex: 0 } });
		const style = wrapper.get('td').attributes('style') ?? '';
		expect(style).toContain('color: #ff0000');
		expect(style).not.toContain('#111827');
	});

	it('renders a resolved cell image fill as a cover background', () => {
		const imaged: PptxTableData = {
			columnWidths: [1],
			rows: [
				{
					cells: [
						{
							text: 'Photo',
							style: {
								fillMode: 'image',
								backgroundImageFillData: 'data:image/png;base64,AAAA',
							},
						},
					],
				},
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(imaged), zIndex: 0 } });
		const style = wrapper.get('td').attributes('style') ?? '';
		expect(style).toContain('background-image: url(');
		expect(style).toContain('data:image/png;base64,AAAA');
		expect(style).toContain('background-size: cover');
	});

	it('renders an explicit zero cell margin as zero padding', () => {
		const dense: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Dense', style: { marginLeft: 0, marginTop: 0 } }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(dense), zIndex: 0 } });
		const style = wrapper.get('td').attributes('style') ?? '';
		expect(style).toContain('padding-left: 0px');
		expect(style).toContain('padding-top: 0px');
	});

	it('applies header-row banding (bold + background) when firstRowHeader is set', () => {
		const headed: PptxTableData = {
			columnWidths: [1],
			firstRowHeader: true,
			rows: [{ cells: [{ text: 'Header' }] }, { cells: [{ text: 'Body' }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(headed), zIndex: 0 } });
		const headerCell = wrapper.findAll('tr')[0].get('td');
		expect(headerCell.attributes('style')).toContain('font-weight: 700');
		expect(headerCell.attributes('style')).toContain('background-color');
	});

	it('renders a diagonal-border SVG overlay when configured', () => {
		const diag: PptxTableData = {
			columnWidths: [1],
			rows: [
				{
					cells: [{ text: 'X', style: { borderDiagDownColor: '#000000', borderDiagDownWidth: 1 } }],
				},
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(diag), zIndex: 0 } });
		expect(wrapper.find('svg line').exists()).toBeTruthy();
	});

	it('renders nothing for an empty table', () => {
		const wrapper = mount(TableRenderer, {
			props: { element: table({ columnWidths: [], rows: [] }), zIndex: 0 },
		});
		expect(wrapper.find('table').exists()).toBeFalsy();
	});

	// ── Feature 1: Rich per-run cell text ───────────────────────────────────

	it('renders multiple styled spans when a cell carries textRuns', () => {
		const runs: CellTextRun[] = [
			{ text: 'Bold', bold: true },
			{ text: ' plain', bold: false },
			{ text: ' italic', italic: true, color: '#ff0000' },
		];
		const data: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [richCell({ text: 'Bold plain italic' }, runs)] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(data), zIndex: 0 } });
		const spans = wrapper.findAll('td span.pptx-vue-table__run');
		expect(spans).toHaveLength(3);
		// Note: @vue/test-utils .text() trims surrounding whitespace.
		expect(spans[0].text()).toBe('Bold');
		expect(spans[0].attributes('style')).toContain('font-weight: bold');
		// The second run has a leading space; check via element innerHTML to avoid trim.
		expect(spans[1].element.textContent).toBe(' plain');
		expect(spans[2].element.textContent).toBe(' italic');
		expect(spans[2].attributes('style')).toContain('font-style: italic');
		expect(spans[2].attributes('style')).toContain('color: #ff0000');
	});

	it('falls back to the plain text span when no textRuns are present', () => {
		const data: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Plain' }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(data), zIndex: 0 } });
		// Plain fallback uses .pptx-vue-table__text, not .pptx-vue-table__run
		expect(wrapper.find('td span.pptx-vue-table__text').exists()).toBeTruthy();
		expect(wrapper.find('td span.pptx-vue-table__run').exists()).toBeFalsy();
		expect(wrapper.get('td').text()).toBe('Plain');
	});

	it('renders a paragraph break between runs when isParagraphBreak is set', () => {
		const runs: CellTextRun[] = [
			{ text: 'Line 1' },
			{ text: '', isParagraphBreak: true },
			{ text: 'Line 2' },
		];
		const data: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [richCell({ text: 'Line 1\nLine 2' }, runs)] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(data), zIndex: 0 } });
		// A paragraph break is rendered as a <div.pptx-vue-table__para-break>
		expect(wrapper.find('div.pptx-vue-table__para-break').exists()).toBeTruthy();
		const textContent = wrapper.get('td').text();
		expect(textContent).toContain('Line 1');
		expect(textContent).toContain('Line 2');
	});

	it('renders a line break as <br> when isLineBreak is set', () => {
		const runs: CellTextRun[] = [
			{ text: 'First' },
			{ text: '', isLineBreak: true },
			{ text: 'Second' },
		];
		const data: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [richCell({ text: 'First\nSecond' }, runs)] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(data), zIndex: 0 } });
		expect(wrapper.find('td br').exists()).toBeTruthy();
	});

	it('renders run font-size and font-family when set', () => {
		const runs: CellTextRun[] = [{ text: 'Styled', fontSize: 16, fontFamily: 'Arial' }];
		const data: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [richCell({ text: 'Styled' }, runs)] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(data), zIndex: 0 } });
		const span = wrapper.get('td span.pptx-vue-table__run');
		expect(span.attributes('style')).toContain('font-size: 16pt');
		expect(span.attributes('style')).toContain('font-family: Arial');
	});

	it('renders strikethrough run with text-decoration: line-through', () => {
		const runs: CellTextRun[] = [{ text: 'Strike', strikethrough: true }];
		const data: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [richCell({ text: 'Strike' }, runs)] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(data), zIndex: 0 } });
		const span = wrapper.get('td span.pptx-vue-table__run');
		expect(span.attributes('style')).toContain('line-through');
	});

	// ── Feature 2: Pattern fills ─────────────────────────────────────────────

	it('renders a pattern-fill cell with a background-image (SVG tile), not a flat colour', () => {
		const patterned: PptxTableData = {
			columnWidths: [1],
			rows: [
				{
					cells: [
						{
							text: 'Pattern',
							style: {
								fillMode: 'pattern',
								patternFillPreset: 'ltDnDiag',
								patternFillForeground: '#0000FF',
								patternFillBackground: '#FFFFFF',
							},
						},
					],
				},
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(patterned), zIndex: 0 } });
		const cell = wrapper.get('td');
		const style = cell.attributes('style') ?? '';
		// The tiled SVG pattern is encoded as a data-URI background-image.
		expect(style).toContain('background-image');
		expect(style).toContain('data:image/svg+xml');
		// The solid background colour (behind the tile) must also be present.
		expect(style).toContain('background-color');
	});

	it('pattern-fill cell does NOT have a simple flat background-image when preset is unknown', () => {
		const unknown: PptxTableData = {
			columnWidths: [1],
			rows: [
				{
					cells: [
						{
							text: 'X',
							style: {
								fillMode: 'pattern',
								patternFillPreset: '__nonexistent_preset__',
								patternFillForeground: '#000000',
								patternFillBackground: '#AABBCC',
							},
						},
					],
				},
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(unknown), zIndex: 0 } });
		const style = wrapper.get('td').attributes('style') ?? '';
		// No SVG encoded image for unknown preset; fallback to background colour.
		expect(style).not.toContain('data:image/svg+xml');
		expect(style).toContain('background-color: #AABBCC');
	});

	// ── Feature 3: Theme scheme-colour band resolution ───────────────────────

	it('resolves header-row colour from theme colorScheme when provided', () => {
		const colorScheme: PptxThemeColorScheme = {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#1F497D',
			lt2: '#EEECE1',
			accent1: '#C0504D', // red-ish, distinct from the default blue fallback
			accent2: '#9BBB59',
			accent3: '#4BACC6',
			accent4: '#8064A2',
			accent5: '#4F81BD',
			accent6: '#F79646',
			hlink: '#0000FF',
			folHlink: '#800080',
		};

		// A minimal table style entry that ties the header row fill to accent1.
		const styleEntry: ParsedTableStyleEntry = {
			styleId: '{TEST-STYLE-1}',
			firstRowFill: { schemeColor: 'accent1' },
		};
		const tableStyleMap: ParsedTableStyleMap = { '{TEST-STYLE-1}': styleEntry };

		const headed: PptxTableData = {
			columnWidths: [1],
			firstRowHeader: true,
			tableStyleId: '{TEST-STYLE-1}',
			rows: [{ cells: [{ text: 'Header' }] }, { cells: [{ text: 'Body' }] }],
		};

		const wrapper = mount(TableRenderer, {
			props: {
				element: table(headed),
				zIndex: 0,
				colorScheme,
				tableStyleMap,
			},
		});
		const headerCell = wrapper.findAll('tr')[0].get('td');
		const style = headerCell.attributes('style') ?? '';
		// The resolved accent1 colour (#C0504D) should appear, not the default blue.
		expect(style).toContain('#C0504D');
		expect(style).not.toContain('rgba(68, 114, 196');
	});

	it('uses hardcoded fallback colour when no colorScheme is provided', () => {
		const headed: PptxTableData = {
			columnWidths: [1],
			firstRowHeader: true,
			rows: [{ cells: [{ text: 'Header' }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(headed), zIndex: 0 } });
		const style = wrapper.findAll('tr')[0].get('td').attributes('style') ?? '';
		// The hardcoded fallback uses rgba(68, 114, 196, …).
		expect(style).toContain('rgba(68, 114, 196');
	});

	it('resolves table-style GUID banding from the injected TableThemeKey (no props)', () => {
		// This exercises the viewer-root provide/inject wiring: the colour scheme
		// and parsed tableStyleMap reach the renderer through TableThemeKey rather
		// than via props (the path PowerPointViewer uses).
		const colorScheme: PptxThemeColorScheme = {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#1F497D',
			lt2: '#EEECE1',
			accent1: '#C0504D',
			accent2: '#9BBB59',
			accent3: '#4BACC6',
			accent4: '#8064A2',
			accent5: '#4F81BD',
			accent6: '#F79646',
			hlink: '#0000FF',
			folHlink: '#800080',
		};
		const styleEntry: ParsedTableStyleEntry = {
			styleId: '{INJECTED-STYLE}',
			firstRowFill: { schemeColor: 'accent1' },
		};
		const tableStyleMap: ParsedTableStyleMap = { '{INJECTED-STYLE}': styleEntry };

		const headed: PptxTableData = {
			columnWidths: [1],
			firstRowHeader: true,
			tableStyleId: '{INJECTED-STYLE}',
			rows: [{ cells: [{ text: 'Header' }] }, { cells: [{ text: 'Body' }] }],
		};

		const wrapper = mount(TableRenderer, {
			props: { element: table(headed), zIndex: 0 },
			global: {
				provide: {
					// InjectionKey symbols are keyed by their symbol value at runtime.
					[TableThemeKey as symbol]: () => ({ colorScheme, tableStyleMap }),
				},
			},
		});
		const headerCell = wrapper.findAll('tr')[0].get('td');
		const style = headerCell.attributes('style') ?? '';
		// The injected accent1 colour (#C0504D) resolves the header fill.
		expect(style).toContain('#C0504D');
		expect(style).not.toContain('rgba(68, 114, 196');
	});

	// ── Inline cell editing ──────────────────────────────────────────────────

	it('does not render a cell input until a cell is double-clicked', () => {
		const { wrapper } = mountEditable(basicGrid);
		expect(wrapper.find('input.pptx-vue-table__cell-input').exists()).toBeFalsy();
	});

	it('enters edit mode on double-click, seeding the input from the cell text', async () => {
		const { wrapper } = mountEditable(basicGrid);
		await wrapper.findAll('td')[1].trigger('dblclick');
		const input = wrapper.get('input.pptx-vue-table__cell-input');
		expect((input.element as HTMLInputElement).value).toBe('B1');
	});

	it('commits the edited text on blur with the original grid coordinates', async () => {
		const { wrapper, commit } = mountEditable(basicGrid);
		await wrapper.findAll('td')[2].trigger('dblclick'); // row 1, col 0 ("A2")
		const input = wrapper.get('input.pptx-vue-table__cell-input');
		await input.setValue('A2 edited');
		await input.trigger('blur');
		expect(commit).toHaveBeenCalledExactlyOnceWith('tbl 1', 1, 0, 'A2 edited');
		// The input is unmounted after commit.
		expect(wrapper.find('input.pptx-vue-table__cell-input').exists()).toBeFalsy();
	});

	it('commits on Enter', async () => {
		const { wrapper, commit } = mountEditable(basicGrid);
		await wrapper.findAll('td')[0].trigger('dblclick');
		const input = wrapper.get('input.pptx-vue-table__cell-input');
		await input.setValue('A1!');
		await input.trigger('keydown', { key: 'Enter' });
		expect(commit).toHaveBeenCalledExactlyOnceWith('tbl 1', 0, 0, 'A1!');
	});

	it('discards the edit on Escape without committing', async () => {
		const { wrapper, commit } = mountEditable(basicGrid);
		await wrapper.findAll('td')[0].trigger('dblclick');
		const input = wrapper.get('input.pptx-vue-table__cell-input');
		await input.setValue('throwaway');
		await input.trigger('keydown', { key: 'Escape' });
		// Escape clears editing state; the ensuing blur must not commit.
		await input.trigger('blur');
		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.find('input.pptx-vue-table__cell-input').exists()).toBeFalsy();
	});

	it('does not enter edit mode when editing is disabled', async () => {
		const { wrapper } = mountEditable(basicGrid, { canEdit: false });
		await wrapper.findAll('td')[0].trigger('dblclick');
		expect(wrapper.find('input.pptx-vue-table__cell-input').exists()).toBeFalsy();
	});

	it('does not enter edit mode when no edit context is provided (read-only viewer)', async () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 0 } });
		await wrapper.findAll('td')[0].trigger('dblclick');
		expect(wrapper.find('input.pptx-vue-table__cell-input').exists()).toBeFalsy();
	});

	it('stops pointerdown propagation from the cell input so the canvas cannot steal focus', async () => {
		const { wrapper } = mountEditable(basicGrid);
		await wrapper.findAll('td')[0].trigger('dblclick');
		const input = wrapper.get('input.pptx-vue-table__cell-input');
		const onParentPointerDown = vi.fn();
		wrapper.element.addEventListener('pointerdown', onParentPointerDown);
		await input.trigger('pointerdown');
		expect(onParentPointerDown).not.toHaveBeenCalled();
	});

	it('resolves band row colour from theme when tableStyleMap has band1HFill', () => {
		const colorScheme: PptxThemeColorScheme = {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#1F497D',
			lt2: '#EEECE1',
			accent1: '#FF6600',
			accent2: '#9BBB59',
			accent3: '#4BACC6',
			accent4: '#8064A2',
			accent5: '#4F81BD',
			accent6: '#F79646',
			hlink: '#0000FF',
			folHlink: '#800080',
		};
		const styleEntry: ParsedTableStyleEntry = {
			styleId: '{TEST-BAND}',
			band1HFill: { schemeColor: 'accent1', tint: 60000 }, // 60% tint of #FF6600
		};
		const tableStyleMap: ParsedTableStyleMap = { '{TEST-BAND}': styleEntry };

		const banded: PptxTableData = {
			columnWidths: [1],
			bandedRows: true,
			tableStyleId: '{TEST-BAND}',
			rows: [
				{ cells: [{ text: 'Band 1' }] },
				{ cells: [{ text: 'Band 2' }] },
				{ cells: [{ text: 'Band 3' }] },
			],
		};
		const wrapper = mount(TableRenderer, {
			props: { element: table(banded), zIndex: 0, colorScheme, tableStyleMap },
		});
		const firstRowStyle = wrapper.findAll('tr')[0].get('td').attributes('style') ?? '';
		// Should NOT be the default fallback rgba(217, 226, 243, …).
		expect(firstRowStyle).not.toContain('rgba(217, 226, 243');
		// Should contain a hex colour (the tinted accent1).
		expect(firstRowStyle).toMatch(/background-color: #[0-9A-Fa-f]{6}/u);
	});

	// ── Cell selection + resize ──────────────────────────────────────────────

	it('selects a cell on click and marks it selected', async () => {
		const { wrapper, selection } = mountSelectable(basicGrid);
		await wrapper.findAll('td')[1].trigger('click'); // row 0, col 1
		expect(selection.value).toMatchObject({ elementId: 'tbl 1', rowIndex: 0, columnIndex: 1 });
		expect(wrapper.findAll('td')[1].classes()).toContain('pptx-vue-table__cell--selected');
	});

	it('extends a rectangular selection on shift+click', async () => {
		const { wrapper, selection } = mountSelectable(basicGrid);
		await wrapper.findAll('td')[0].trigger('click'); // anchor row 0, col 0
		await wrapper.findAll('td')[3].trigger('click', { shiftKey: true }); // row 1, col 1
		expect(selection.value?.selectedCells).toHaveLength(4);
		// Non-anchor cells in the rect get the in-selection highlight.
		expect(wrapper.findAll('td')[3].classes()).toContain('pptx-vue-table__cell--in-selection');
	});

	/**
	 * The gesture, not the maths.
	 *
	 * `computeCellSelection` was always correct, and the test above always
	 * passed, because a mounted `TableRenderer` has no canvas above it. In the
	 * real viewer the `<td>` press bubbles to `<main>`'s `@pointerdown`, whose
	 * additive branch TOGGLED this table out of the slide selection; the
	 * selection watcher then nulled the cell selection, so the click handler
	 * found no anchor and could only ever select one cell. Block merge was
	 * unreachable in Vue: its context menu offered "merge right / merge down"
	 * where React offered "merge selected cells". A Shift-press inside a cell of
	 * the selected table must therefore be CONSUMED before it reaches an
	 * ancestor.
	 */
	it('consumes a shift+pointerdown inside a cell so the canvas cannot toggle the table', async () => {
		const { wrapper } = mountSelectable(basicGrid),
			reachedCanvas = vi.fn();
		wrapper.element.addEventListener('pointerdown', reachedCanvas);

		// A plain press still reaches the canvas: that is what selects the table
		// and arms the drag.
		await wrapper.findAll('td')[0].trigger('pointerdown', { pointerType: 'mouse' });
		expect(reachedCanvas).toHaveBeenCalledOnce();

		// Anchor the range, then Shift-press: this one must stop at the cell.
		await wrapper.findAll('td')[0].trigger('click');
		await wrapper.findAll('td')[3].trigger('pointerdown', { pointerType: 'mouse', shiftKey: true });
		expect(reachedCanvas).toHaveBeenCalledOnce();
	});

	it('lets a shift+pointerdown through when there is no range to extend', async () => {
		const { wrapper } = mountSelectable(basicGrid),
			reachedCanvas = vi.fn();
		wrapper.element.addEventListener('pointerdown', reachedCanvas);
		// No cell selected yet, so the press is an ordinary element press and the
		// canvas must still see it (otherwise the table could never be selected).
		await wrapper.findAll('td')[3].trigger('pointerdown', { pointerType: 'mouse', shiftKey: true });
		expect(reachedCanvas).toHaveBeenCalledOnce();
	});

	it('does not select cells when no selection context is provided', async () => {
		const commit = vi.fn();
		const wrapper = mount(TableRenderer, {
			props: { element: table(basicGrid), zIndex: 0 },
			global: { provide: { [TableCellEditKey as symbol]: { canEdit: () => true, commit } } },
		});
		await wrapper.findAll('td')[0].trigger('click');
		expect(wrapper.findAll('td')[0].classes()).not.toContain('pptx-vue-table__cell--selected');
	});

	it('renders column + row resize handles when editable', () => {
		const { wrapper } = mountSelectable(basicGrid);
		expect(wrapper.find('.pptx-vue-table-resize__col').exists()).toBeTruthy();
	});

	it('does not render resize handles in a read-only viewer', () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 0 } });
		expect(wrapper.find('.pptx-vue-table-resize__col').exists()).toBeFalsy();
	});
});
