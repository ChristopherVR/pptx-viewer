// @vitest-environment happy-dom
import type { PptxUiSelectElement } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FontPickers } from './FontPickers';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe('shared font fields in React', () => {
	it('shows fractional sizes and forwards a real Web Component change exactly once', async () => {
		const onFamily = vi.fn();
		const onSize = vi.fn();
		await act(async () =>
			root.render(
				<FontPickers
					enabled
					fontFamily='Deck Font'
					fontSize='40.5'
					onFamily={onFamily}
					onSize={onSize}
				/>,
			),
		);
		const size = container.querySelector<PptxUiSelectElement>(
			'pptx-ui-select[data-font-picker="size"]',
		)!;
		expect(size.shadowRoot!.querySelector('[part="value"]')?.textContent).toBe('40.5');
		await act(async () => {
			size.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
			const index = size.options.findIndex((option) => option.value === '24');
			size.shadowRoot!.querySelector<HTMLElement>(`[data-index="${index}"]`)!.click();
		});
		expect(onSize).toHaveBeenCalledExactlyOnceWith(24);
		expect(onFamily).not.toHaveBeenCalled();
	});

	it('closes an open family menu when the selection becomes ineligible', async () => {
		const props = { fontFamily: 'Calibri', fontSize: '24', onFamily: vi.fn(), onSize: vi.fn() };
		await act(async () => root.render(<FontPickers enabled {...props} />));
		const family = container.querySelector<PptxUiSelectElement>(
			'pptx-ui-select[data-font-picker="family"]',
		)!;
		family.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
		expect(family.hasAttribute('open')).toBeTruthy();
		await act(async () => root.render(<FontPickers enabled={false} {...props} />));
		expect(family.disabled).toBeTruthy();
		expect(family.hasAttribute('open')).toBeFalsy();
		expect(props.onFamily).not.toHaveBeenCalled();
	});

	it('resyncs both fields and replaces native callbacks when selection changes', async () => {
		const previous = { onFamily: vi.fn(), onSize: vi.fn() };
		const current = { onFamily: vi.fn(), onSize: vi.fn() };
		await act(async () =>
			root.render(<FontPickers enabled={false} fontFamily='Calibri' fontSize='24' {...previous} />),
		);
		const family = container.querySelector<PptxUiSelectElement>('[data-font-picker="family"]')!;
		const size = container.querySelector<PptxUiSelectElement>('[data-font-picker="size"]')!;
		for (const field of [family, size]) {
			expect(field.disabled).toBeTruthy();
		}

		await act(async () =>
			root.render(<FontPickers enabled fontFamily='Arial' fontSize='40.5' {...current} />),
		);
		expect(family.value).toBe('Arial');
		expect(size.value).toBe('40.5');
		for (const [field, value] of [
			[family, 'Calibri'],
			[size, '24'],
		] as const) {
			expect(field.disabled).toBeFalsy();
			expect(field.hasAttribute('disabled')).toBeFalsy();
			await act(async () => {
				field.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!.click();
				expect(field.hasAttribute('open')).toBeTruthy();
				const index = field.options.findIndex((option) => option.value === value);
				field.shadowRoot!.querySelector<HTMLElement>(`[data-index="${index}"]`)!.click();
			});
		}
		expect(current.onFamily).toHaveBeenCalledExactlyOnceWith('Calibri');
		expect(current.onSize).toHaveBeenCalledExactlyOnceWith(24);
		expect(previous.onFamily).not.toHaveBeenCalled();
		expect(previous.onSize).not.toHaveBeenCalled();

		await act(async () => root.render(null));
		family.dispatchEvent(new Event('change', { bubbles: true }));
		size.dispatchEvent(new Event('change', { bubbles: true }));
		expect(current.onFamily).toHaveBeenCalledOnce();
		expect(current.onSize).toHaveBeenCalledOnce();
	});
});
