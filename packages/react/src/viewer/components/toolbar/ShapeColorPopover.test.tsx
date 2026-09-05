// @vitest-environment happy-dom
/**
 * W3-G3: the ribbon's Shape Fill / Shape Outline popover shows the deck's
 * real theme palette (via `ThemeColorSwatchGrid`) above the flat standard
 * swatches, and a theme swatch pick commits both the resolved hex AND its
 * `PptxThemeColorRef` so the fill/outline keeps following the theme after a
 * later theme change; a standard swatch pick clears the ref.
 */
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeColorMapProvider } from '../inspector/ThemeColorMapContext';
import { ShapeColorPopover } from './ShapeColorPopover';

const OFFICE_THEME = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	bg1: '#FFFFFF',
	tx1: '#000000',
	bg2: '#E7E6E6',
	tx2: '#44546A',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function renderPopover(onApply: (color: string, ref?: ThemeColorPickerCommit['ref']) => void) {
	const anchorRef = createRef<HTMLDivElement>();
	act(() => {
		root.render(
			<ThemeColorMapProvider value={OFFICE_THEME}>
				<ShapeColorPopover
					icon={<span />}
					title='Shape Fill'
					prefix='shape-fill'
					anchorRef={anchorRef}
					open
					onToggle={() => {}}
					disabled={false}
					swatchAriaLabel='Fill colour'
					onApply={onApply}
					onClose={() => {}}
				/>
			</ThemeColorMapProvider>,
		);
	});
}

describe('shapeColorPopover', () => {
	it('renders the theme colour grid above the standard swatches', () => {
		renderPopover(() => {});
		const themeSwatch = container.querySelector('button[title="Accent 1"]');
		expect(themeSwatch).not.toBeNull();
	});

	it('commits both the resolved hex and the ref on a theme swatch click', () => {
		let applied: [string, ThemeColorPickerCommit['ref']] | undefined;
		renderPopover((color, ref) => {
			applied = [color, ref];
		});
		const accent1 = container.querySelector('button[title="Accent 1"]') as HTMLElement;
		act(() => accent1.click());
		expect(applied).toStrictEqual(['#4472c4', { scheme: 'accent1' }]);
	});

	it('clears the ref on a standard swatch click', () => {
		let applied: [string, ThemeColorPickerCommit['ref']] | undefined;
		renderPopover((color, ref) => {
			applied = [color, ref];
		});
		const standard = container.querySelector(
			'button[aria-label="Fill colour #c00000"]',
		) as HTMLElement;
		expect(standard).not.toBeNull();
		act(() => standard.click());
		expect(applied?.[0]).toBe('#c00000');
		expect(applied?.[1]).toBeFalsy();
	});
});
