import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartUserShapeSection from './ChartUserShapeSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1'],
		series: [{ name: 'Revenue', values: [10] }],
		...overrides,
	};
}

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

function mountSection(
	data: PptxChartData,
	canEdit = true,
): { target: HTMLElement; onpatch: ReturnType<typeof vi.fn> } {
	const onpatch = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartUserShapeSection, {
		target,
		props: { data, canEdit, onpatch },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onpatch };
}

describe('chartUserShapeSection', () => {
	it('shows the empty state with no overlay shapes', () => {
		const { target } = mountSection(chartData());
		expect(target.textContent).toContain('No overlay shapes on this chart.');
	});

	it('renders one row per overlay shape', () => {
		const { target } = mountSection(chartData({ userShapes: [textBoxShape] }));
		expect(target.textContent).toContain('Note');
	});

	it('calls onpatch with an appended shape when the add button is clicked', () => {
		const { target, onpatch } = mountSection(chartData());
		const addButton = Array.from(target.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('Add text box'),
		)!;
		addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(onpatch).toHaveBeenCalledOnce();
		const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
		expect(patch.userShapes).toHaveLength(1);
		expect(patch.userShapes![0].kind).toBe('sp');
	});

	it('calls onpatch with the shape removed when delete is clicked', () => {
		const { target, onpatch } = mountSection(chartData({ userShapes: [textBoxShape] }));
		const deleteButton = target.querySelector('button[aria-label="Delete overlay shape"]')!;
		deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(onpatch).toHaveBeenCalledWith({ userShapes: [] });
	});

	it('disables add/delete controls in read-only mode', () => {
		const { target } = mountSection(chartData({ userShapes: [textBoxShape] }), false);
		const buttons = target.querySelectorAll<HTMLButtonElement>('button');
		expect(Array.from(buttons).every((b) => b.disabled)).toBeTruthy();
	});

	// W2-F: a grpSp's grouped children are now individually editable rows.
	describe('grpSp grouped children', () => {
		const grouped: PptxChartUserShape = {
			kind: 'grpSp',
			anchor: 'rel',
			from: { x: 0, y: 0 },
			to: { x: 1, y: 1 },
			transform: {
				off: { x: 0, y: 0 },
				ext: { cx: 1000000, cy: 1000000 },
				chOff: { x: 0, y: 0 },
				chExt: { cx: 1000000, cy: 1000000 },
			},
			children: [
				{
					kind: 'sp',
					off: { x: 0, y: 0 },
					ext: { cx: 500000, cy: 1000000 },
					paragraphs: [{ text: 'Alpha' }],
				},
			],
		};

		it('renders the group row plus an indented, editable child row', () => {
			const { target } = mountSection(chartData({ userShapes: [grouped] }));
			expect(target.querySelector('[data-chart-user-shape-path="0"]')).toBeTruthy();
			expect(target.querySelector('[data-chart-user-shape-path="0,0"]')).toBeTruthy();
			expect(target.textContent).toContain('Alpha');
		});

		it("edits the child row text and clears the group ancestor's rawXml", () => {
			const groupWithRaw: PptxChartUserShape = { ...grouped, rawXml: { '@_x': '1' } };
			const { target, onpatch } = mountSection(chartData({ userShapes: [groupWithRaw] }));
			const childRow = target.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const textInput = childRow.querySelector('input[aria-label="Text"]') as HTMLInputElement;
			textInput.value = 'Alpha edited';
			textInput.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			const next = patch.userShapes![0];
			expect(next.rawXml).toBeUndefined();
			expect(next.children![0].paragraphs).toStrictEqual([{ text: 'Alpha edited' }]);
		});

		it('lets a top-level group row edit its own drawing anchor (moves/resizes the whole group)', () => {
			const { target, onpatch } = mountSection(chartData({ userShapes: [grouped] }));
			const groupRow = target.querySelector('[data-chart-user-shape-path="0"]')!;
			const fromXInput = groupRow.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
			fromXInput.value = '0.2';
			fromXInput.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0].from).toStrictEqual({ x: 0.2, y: 0 });
		});

		it('presents a nested child row as a chart-relative from/to fraction, not raw EMU', () => {
			const { target } = mountSection(chartData({ userShapes: [grouped] }));
			const childRow = target.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const values = Array.from(
				childRow.querySelectorAll<HTMLInputElement>('input[type="number"]'),
			).map((i) => i.value);
			// A trailing rotation field (0: this child has none) follows from/to.
			expect(values).toStrictEqual(['0', '0', '0.5', '1', '0']);
		});

		it('writes a nested fraction edit back as EMU off/ext', () => {
			const { target, onpatch } = mountSection(chartData({ userShapes: [grouped] }));
			const childRow = target.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const toXInput = childRow.querySelectorAll('input[type="number"]')[2] as HTMLInputElement;
			toXInput.value = '0.25';
			toXInput.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0].children![0]).toMatchObject({
				off: { x: 0, y: 0 },
				ext: { cx: 250000, cy: 1000000 },
			});
		});

		it('writes a rotation edit on a top-level leaf row directly onto its own rotation field', () => {
			const { target, onpatch } = mountSection(chartData({ userShapes: [textBoxShape] }));
			const numberInputs = target.querySelectorAll<HTMLInputElement>('input[type="number"]');
			const rotationInput = numberInputs[numberInputs.length - 1]!;
			rotationInput.value = '30';
			rotationInput.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).toMatchObject({ rotation: 30 });
		});

		it("writes a group row's rotation edit into its own transform, not a flat field", () => {
			const { target, onpatch } = mountSection(chartData({ userShapes: [grouped] }));
			const groupRow = target.querySelector('[data-chart-user-shape-path="0"]')!;
			const numberInputs = groupRow.querySelectorAll<HTMLInputElement>('input[type="number"]');
			const rotationInput = numberInputs[numberInputs.length - 1]!;
			rotationInput.value = '45';
			rotationInput.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).not.toHaveProperty('rotation');
			expect(patch.userShapes![0].transform).toMatchObject({ rotation: 45 });
		});

		it('writes a flip edit on a top-level leaf row directly onto its own flip fields', () => {
			const { target, onpatch } = mountSection(chartData({ userShapes: [textBoxShape] }));
			const flipHInput = target.querySelector<HTMLInputElement>(
				'input[aria-label="Flip horizontally"]',
			)!;
			flipHInput.checked = true;
			flipHInput.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).toMatchObject({ flipH: true });
		});

		it("writes a group row's flip edit into its own transform, not a flat field", () => {
			const { target, onpatch } = mountSection(chartData({ userShapes: [grouped] }));
			const groupRow = target.querySelector('[data-chart-user-shape-path="0"]')!;
			const flipVInput = groupRow.querySelector<HTMLInputElement>(
				'input[aria-label="Flip vertically"]',
			)!;
			flipVInput.checked = true;
			flipVInput.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).not.toHaveProperty('flipV');
			expect(patch.userShapes![0].transform).toMatchObject({ flipV: true });
		});

		it('adds a new default shape into a group via "Add shape here"', () => {
			const { target, onpatch } = mountSection(chartData({ userShapes: [grouped] }));
			const groupRow = target.querySelector('[data-chart-user-shape-path="0"]')!;
			const addIntoGroupButton = Array.from(groupRow.querySelectorAll('button')).find((b) =>
				b.textContent?.includes('Add shape here'),
			)!;
			addIntoGroupButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			flushSync();
			expect(onpatch).toHaveBeenCalledOnce();
			const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
			const children = patch.userShapes![0].children!;
			expect(children).toHaveLength(2);
			expect(children[1]).toMatchObject({ kind: 'sp', off: { x: 350000, y: 400000 } });
		});
	});
});
