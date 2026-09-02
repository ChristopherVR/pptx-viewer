// @vitest-environment happy-dom
/**
 * B6 (wave-4): recent colours. `RecentColorsRow` is the row extracted out of
 * `ColorPickerRow` so pickers that are not built on its swatch/eyedropper
 * layout (text colour, ribbon font-colour menu, shape fill/outline
 * popovers) can render the identical row.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentColorsProvider } from './RecentColorsContext';
import { RecentColorsRow } from './RecentColorsRow';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe('recentColorsRow (wave-4 B6)', () => {
	it('renders nothing while the list is empty', () => {
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: [], pushColor: () => {} }}>
					<RecentColorsRow prefix='p' onCommit={() => {}} />
				</RecentColorsProvider>,
			);
		});
		expect(container.querySelector('[data-testid="pptx-color-recent"]')).toBeNull();
	});

	it('renders one swatch per recent colour, most-recent first', () => {
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: ['#112233', '#445566'], pushColor: () => {} }}>
					<RecentColorsRow prefix='p' onCommit={() => {}} />
				</RecentColorsProvider>,
			);
		});
		const row = container.querySelector('[data-testid="pptx-color-recent"]')!;
		const swatches = row.querySelectorAll('button[data-pptx-compact]');
		expect(swatches).toHaveLength(2);
		expect((swatches[0] as HTMLElement).title).toBe('#112233');
		expect((swatches[0] as HTMLElement).getAttribute('aria-label')).toBe('Recent #112233');
	});

	it('clicking a swatch commits the colour AND pushes it', () => {
		const onCommit = vi.fn();
		const pushColor = vi.fn();
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: ['#112233'], pushColor }}>
					<RecentColorsRow prefix='p' onCommit={onCommit} />
				</RecentColorsProvider>,
			);
		});
		const swatch = container.querySelector(
			'[data-testid="pptx-color-recent"] button[data-pptx-compact]',
		) as HTMLButtonElement;
		act(() => swatch.click());
		expect(onCommit).toHaveBeenCalledWith('#112233');
		expect(pushColor).toHaveBeenCalledWith('#112233');
	});

	it('disables every swatch when disabled is set', () => {
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: ['#112233'], pushColor: () => {} }}>
					<RecentColorsRow prefix='p' disabled onCommit={() => {}} />
				</RecentColorsProvider>,
			);
		});
		const swatch = container.querySelector(
			'[data-testid="pptx-color-recent"] button[data-pptx-compact]',
		) as HTMLButtonElement;
		expect(swatch.disabled).toBeTruthy();
	});
});
