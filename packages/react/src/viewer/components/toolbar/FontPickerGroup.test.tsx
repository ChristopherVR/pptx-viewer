// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FontPickerGroup } from './FontPickerGroup';
import { TextSection } from './TextSection';

registerPptxWebControls();

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

type Field = HTMLElement & { value: string; disabled: boolean };
const field = (name: 'family' | 'size') =>
	container.querySelector<Field>(`[data-font-picker="${name}"]`)!;

describe('shared font picker group', () => {
	it('shows fractional sizes and forwards a change exactly once', () => {
		const onFamily = vi.fn();
		const onSize = vi.fn();
		act(() =>
			root.render(
				<FontPickerGroup
					enabled
					fontFamily='Deck Font'
					fontSize='40.5'
					onFamily={onFamily}
					onSize={onSize}
				/>,
			),
		);
		expect(field('size').value).toBe('40.5');
		field('size').value = '24';
		act(() => void field('size').dispatchEvent(new Event('change', { bubbles: true })));
		expect(onSize).toHaveBeenCalledExactlyOnceWith(24);
		expect(onFamily).not.toHaveBeenCalled();
		// The fields belong to the Font group the Text section draws, not a group of their own.
		expect(container.querySelector('[data-ribbon-group]')).toBeNull();
	});

	it('names the fields after the control and resyncs when the selection changes', () => {
		const props = { fontFamily: 'Calibri', fontSize: '24', onFamily: vi.fn(), onSize: vi.fn() };
		act(() => root.render(<FontPickerGroup enabled={false} {...props} />));
		expect(field('family').getAttribute('aria-label')).toBe('Font family');
		expect(field('size').getAttribute('aria-label')).toBe('Font size');
		expect(field('family').disabled).toBeTruthy();
		act(() => root.render(<FontPickerGroup enabled {...props} fontFamily='Arial' fontSize='36' />));
		expect(field('family').disabled).toBeFalsy();
		expect(field('family').value).toBe('Arial');
		expect(field('size').value).toBe('36');
	});
});

describe('home font pickers', () => {
	const mount = (selectedElement: PptxElement | null, canEdit = true) =>
		act(() =>
			root.render(
				<TextSection
					canEdit={canEdit}
					selectedElement={selectedElement}
					onUpdateTextStyle={vi.fn()}
					onToggleBullets={vi.fn()}
					onTransformTextCase={vi.fn()}
				/>,
			),
		);

	it.each([
		['empty selection', null, true, true],
		['image selection', { type: 'image', id: 'i1' }, true, true],
		['read-only text', { type: 'text', id: 't1' }, false, true],
		['text selection', { type: 'text', id: 't1' }, true, false],
		['empty shape', { type: 'shape', id: 's1' }, true, false],
	] as const)('gates the fields for %s', (_name, element, canEdit, disabled) => {
		mount(element as PptxElement | null, canEdit);
		expect(field('family').disabled).toBe(disabled);
		expect(field('size').disabled).toBe(disabled);
	});

	it('shows the default family and size, converting model pixels to points', () => {
		mount(null);
		expect(field('family').value).toBe('Segoe UI');
		expect(field('size').value).toBe('24');
		mount({
			type: 'text',
			id: 'font-size',
			x: 0,
			y: 0,
			width: 100,
			height: 20,
			text: 'Hello',
			textStyle: { fontSize: 32 },
			textSegments: [{ text: 'Hello', style: { fontSize: 48.1 * (96 / 72) } }],
		} as never);
		expect(field('size').value).toBe('48.1');
	});
});
