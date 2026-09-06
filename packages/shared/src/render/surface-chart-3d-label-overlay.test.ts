import { describe, expect, it } from 'vitest';

import type { SurfaceLabel } from './surface-chart-3d-geom';
import { createLabelOverlay } from './surface-chart-3d-label-overlay';

function fakeNode() {
	return {
		style: {} as Record<string, string>,
		textContent: '',
		children: [] as unknown[],
		appendChild(child: unknown) {
			this.children.push(child);
		},
	};
}

function fakeDoc() {
	return {
		createElement: () => fakeNode(),
	} as unknown as Document;
}

function labels(): SurfaceLabel[] {
	return [
		{ key: 'cat-0', text: 'Cat A', axis: 'category', anchor: [0, 0, 0] },
		{ key: 'val-0', text: '10', axis: 'value', anchor: [0, 1, 0] },
	];
}

describe('createLabelOverlay', () => {
	it('creates one node per label with base font size and axis colour', () => {
		const overlay = createLabelOverlay(fakeDoc(), labels());
		expect(overlay.nodes).toHaveLength(2);
		expect(overlay.nodes[0].style.fontSize).toBe('9px');
		expect(overlay.nodes[0].style.color).toBe('#666');
		expect(overlay.nodes[1].style.color).toBe('#999');
		expect(overlay.nodes[1].style.writingMode).toBe('vertical-rl');
	});

	describe('applyTextStyle', () => {
		it('applies bold/italic/underline/colour/fontScale to every label', () => {
			const overlay = createLabelOverlay(fakeDoc(), labels());
			overlay.applyTextStyle({
				bold: true,
				italic: true,
				underline: true,
				color: '#f00',
				fontScale: 2,
			});
			for (const node of overlay.nodes) {
				expect(node.style.fontWeight).toBe('bold');
				expect(node.style.fontStyle).toBe('italic');
				expect(node.style.textDecorationLine).toBe('underline');
				expect(node.style.color).toBe('#f00');
				expect(node.style.fontSize).toBe('18px');
			}
		});

		it('applies explicit false overrides (normal/none)', () => {
			const overlay = createLabelOverlay(fakeDoc(), labels());
			overlay.applyTextStyle({ bold: false, italic: false, underline: false });
			expect(overlay.nodes[0].style.fontWeight).toBe('normal');
			expect(overlay.nodes[0].style.fontStyle).toBe('normal');
			expect(overlay.nodes[0].style.textDecorationLine).toBe('none');
		});

		it('falls back to each label axis own base colour when no colour override is given', () => {
			const overlay = createLabelOverlay(fakeDoc(), labels());
			overlay.applyTextStyle({ bold: true });
			expect(overlay.nodes[0].style.color).toBe('#666');
			expect(overlay.nodes[1].style.color).toBe('#999');
		});

		it('clears every override and restores the base font size when called with undefined', () => {
			const overlay = createLabelOverlay(fakeDoc(), labels());
			overlay.applyTextStyle({ bold: true, fontScale: 3 });
			overlay.applyTextStyle(undefined);
			expect(overlay.nodes[0].style.fontWeight).toBe('');
			expect(overlay.nodes[0].style.fontSize).toBe('9px');
			expect(overlay.nodes[0].style.color).toBe('#666');
		});

		it('ignores a non-finite or non-positive fontScale', () => {
			const overlay = createLabelOverlay(fakeDoc(), labels());
			overlay.applyTextStyle({ fontScale: Number.NaN });
			expect(overlay.nodes[0].style.fontSize).toBe('9px');
			overlay.applyTextStyle({ fontScale: -1 });
			expect(overlay.nodes[0].style.fontSize).toBe('9px');
		});
	});
});
