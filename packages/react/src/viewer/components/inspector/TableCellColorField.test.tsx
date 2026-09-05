// @vitest-environment happy-dom
/**
 * W3-G3: table cell text/fill colour pickers show the deck's theme palette
 * and commit a `PptxThemeColorRef` alongside the resolved hex; the native
 * colour input clears any previously-stored ref.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TableCellColorField } from './TableCellColorField';
import { ThemeColorMapProvider } from './ThemeColorMapContext';

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

describe('tableCellColorField', () => {
	it('commits both the resolved hex and the ref on a theme swatch click', () => {
		let committed: [string, unknown] | undefined;
		act(() => {
			root.render(
				<ThemeColorMapProvider value={OFFICE_THEME}>
					<TableCellColorField
						label='Background'
						prefix='table-cell-bg'
						value='#ffffff'
						fallback='#ffffff'
						selectedRef={undefined}
						disabled={false}
						onCommit={(hex, ref) => (committed = [hex, ref])}
					/>
				</ThemeColorMapProvider>,
			);
		});
		const accent1 = container.querySelector('button[title="Accent 1"]') as HTMLElement;
		expect(accent1).not.toBeNull();
		act(() => accent1.click());
		expect(committed).toStrictEqual(['#4472c4', { scheme: 'accent1' }]);
	});

	it('clears the ref when the native colour input changes', () => {
		let committed: [string, unknown] | undefined;
		act(() => {
			root.render(
				<ThemeColorMapProvider value={OFFICE_THEME}>
					<TableCellColorField
						label='Background'
						prefix='table-cell-bg'
						value='#4472c4'
						fallback='#ffffff'
						selectedRef={{ scheme: 'accent1' }}
						disabled={false}
						onCommit={(hex, ref) => (committed = [hex, ref])}
					/>
				</ThemeColorMapProvider>,
			);
		});
		const input = container.querySelector('input[type="color"]') as HTMLInputElement;
		act(() => {
			const nativeSetter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value',
			)?.set;
			nativeSetter?.call(input, '#ff0000');
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(committed?.[0]).toBe('#ff0000');
		expect(committed?.[1]).toBeFalsy();
	});
});
