// @vitest-environment happy-dom
/** ShapeTextPanels interaction tests, including font size and recent colours. */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentColorsProvider } from './RecentColorsContext';
import { ShapeTextPanels } from './ShapeTextPanels';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
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

function textElement(): PptxElement {
	return {
		type: 'text',
		id: 'txt_1',
		x: 0,
		y: 0,
		width: 300,
		height: 80,
		text: 'Hello',
		textStyle: { color: '#000000' },
	} as PptxElement;
}

describe('shapeTextPanels', () => {
	it('shows exact point sizes and converts edits back to model pixels', () => {
		const onUpdateTextStyle = vi.fn();
		const selectedElement = textElement();
		selectedElement.textStyle = { color: '#000000', fontSize: 48.1 * (96 / 72) };

		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: [], pushColor: () => {} }}>
					<ShapeTextPanels
						selectedElement={selectedElement}
						canEdit
						onUpdateElement={() => {}}
						onUpdateElementStyle={() => {}}
						onUpdateTextStyle={onUpdateTextStyle}
					/>
				</RecentColorsProvider>,
			);
		});

		const input = container.querySelector(
			'[data-pptx-text-card] input[type="number"]',
		) as HTMLInputElement;
		expect(input.value).toBe('48.1');
		expect(input.step).toBe('any');
		expect(onUpdateTextStyle).not.toHaveBeenCalled();

		act(() => {
			const nativeSetter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value',
			)!.set!;
			nativeSetter.call(input, '10.5');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
		const patch = onUpdateTextStyle.mock.lastCall?.[0] as { fontSize?: number } | undefined;
		expect(patch?.fontSize).toBeCloseTo(10.5 * (96 / 72));
	});

	it('renders the recent-colours row under the text colour picker', () => {
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: ['#112233'], pushColor: () => {} }}>
					<ShapeTextPanels
						selectedElement={textElement()}
						canEdit
						onUpdateElement={() => {}}
						onUpdateElementStyle={() => {}}
						onUpdateTextStyle={() => {}}
					/>
				</RecentColorsProvider>,
			);
		});
		const row = container.querySelector('[data-pptx-text-card] [data-testid="pptx-color-recent"]');
		expect(row).not.toBeNull();
		expect(row!.querySelectorAll('button[data-pptx-compact]')).toHaveLength(1);
	});

	it('renders no row while the recent-colours list is empty', () => {
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: [], pushColor: () => {} }}>
					<ShapeTextPanels
						selectedElement={textElement()}
						canEdit
						onUpdateElement={() => {}}
						onUpdateElementStyle={() => {}}
						onUpdateTextStyle={() => {}}
					/>
				</RecentColorsProvider>,
			);
		});
		expect(container.querySelector('[data-testid="pptx-color-recent"]')).toBeNull();
	});

	it('clicking a recent swatch commits the text colour AND pushes it', () => {
		const onUpdateTextStyle = vi.fn();
		const pushColor = vi.fn();
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: ['#112233'], pushColor }}>
					<ShapeTextPanels
						selectedElement={textElement()}
						canEdit
						onUpdateElement={() => {}}
						onUpdateElementStyle={() => {}}
						onUpdateTextStyle={onUpdateTextStyle}
					/>
				</RecentColorsProvider>,
			);
		});
		const swatch = container.querySelector(
			'[data-pptx-text-card] [data-testid="pptx-color-recent"] button[data-pptx-compact]',
		) as HTMLButtonElement;
		act(() => swatch.click());
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ color: '#112233' });
		expect(pushColor).toHaveBeenCalledWith('#112233');
	});

	it('picking the native text colour input pushes it into the recent list', () => {
		const pushColor = vi.fn();
		act(() => {
			root.render(
				<RecentColorsProvider value={{ recentColors: [], pushColor }}>
					<ShapeTextPanels
						selectedElement={textElement()}
						canEdit
						onUpdateElement={() => {}}
						onUpdateElementStyle={() => {}}
						onUpdateTextStyle={() => {}}
					/>
				</RecentColorsProvider>,
			);
		});
		const input = container.querySelector('input[aria-label="Text Color"]') as HTMLInputElement;
		act(() => {
			const nativeSetter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value',
			)!.set!;
			nativeSetter.call(input, '#ff0000');
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(pushColor).toHaveBeenCalledWith('#ff0000');
	});
});
