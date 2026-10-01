// @vitest-environment happy-dom
/**
 * Home > Font character strip: the shared `pptx-ui-ribbon-home-font` element
 * reflects the element's formatting; this adapter keeps the native text-style
 * edits (toggle tri-state, size steps, Clear Formatting, Text Shadow).
 */
import type { PptxElement } from 'pptx-viewer-core';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FontFormatGroup } from './FontFormatGroup';
import type { FontFormatGroupProps } from './FontFormatGroup';

registerPptxWebControls();

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

const text = (textStyle: Record<string, unknown> = {}) =>
	({
		type: 'text',
		id: 'font-format',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		text: 'Hello',
		textStyle,
	}) as PptxElement;

function mountGroup(overrides: Partial<FontFormatGroupProps> = {}) {
	const selectedElement = overrides.selectedElement ?? text({ italic: true });
	const props: FontFormatGroupProps = {
		canMut: true,
		canFormat: true,
		isTextEl: true,
		selectedElement,
		effectiveTs: (selectedElement as { textStyle?: object }).textStyle,
		onUpdateTextStyle: vi.fn<() => void>(),
		...overrides,
	};
	act(() => root.render(<FontFormatGroup {...props} />));
	const button = (id: string) =>
		container.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.font.${id}"]`)!;
	return { props, button };
}

describe('font format group', () => {
	it('reflects pressed state and gates every control on an editable text selection', () => {
		const { button } = mountGroup();
		expect(button('italic').getAttribute('aria-pressed')).toBe('true');
		expect(button('bold').getAttribute('aria-pressed')).toBe('false');
		expect(button('bold').disabled).toBeFalsy();
		act(() => root.render(<FontFormatGroup {...mountProps({ canMut: false })} />));
		for (const id of ['bold', 'shadow', 'increaseFontSize', 'clearFormatting']) {
			expect(button(id).disabled).toBeTruthy();
		}
	});

	it('toggles a character flag from the shared tri-state', () => {
		const { props, button } = mountGroup();
		act(() => button('bold').click());
		expect(props.onUpdateTextStyle).toHaveBeenCalledExactlyOnceWith({ bold: true });
		act(() => button('italic').click());
		expect(props.onUpdateTextStyle).toHaveBeenLastCalledWith({ italic: false });
	});

	it('steps sizes in points, toggles the shadow and clears formatting', () => {
		const { props, button } = mountGroup({
			selectedElement: text({ fontSize: 48.1 * (96 / 72) }),
			effectiveTs: { fontSize: 48.1 * (96 / 72) },
		});
		act(() => button('increaseFontSize').click());
		const grown = vi.mocked(props.onUpdateTextStyle).mock.lastCall?.[0]?.fontSize;
		expect(grown).toBeCloseTo(50.1 * (96 / 72));
		act(() => button('decreaseFontSize').click());
		expect(vi.mocked(props.onUpdateTextStyle).mock.lastCall?.[0]?.fontSize).toBeCloseTo(
			46.1 * (96 / 72),
		);
		act(() => button('shadow').click());
		expect(vi.mocked(props.onUpdateTextStyle).mock.lastCall?.[0]).toMatchObject({
			textShadowColor: '#000000',
		});
		act(() => button('clearFormatting').click());
		expect(vi.mocked(props.onUpdateTextStyle).mock.lastCall?.[0]).toMatchObject({
			bold: false,
			highlightColor: undefined,
		});
	});

	it('turns an existing shadow off and ignores disabled requests', () => {
		const { props, button } = mountGroup({
			selectedElement: text({ textShadowColor: '#123456' }),
			effectiveTs: { textShadowColor: '#123456' },
		});
		expect(button('shadow').getAttribute('aria-pressed')).toBe('true');
		act(() => button('shadow').click());
		expect(vi.mocked(props.onUpdateTextStyle).mock.lastCall?.[0]).toMatchObject({
			textShadowColor: undefined,
		});
		const second = vi.fn<() => void>();
		act(() =>
			root.render(
				<FontFormatGroup {...mountProps({ canFormat: false, onUpdateTextStyle: second })} />,
			),
		);
		act(() => button('bold').click());
		expect(second).not.toHaveBeenCalled();
	});
});

function mountProps(overrides: Partial<FontFormatGroupProps>): FontFormatGroupProps {
	return {
		canMut: true,
		canFormat: true,
		isTextEl: true,
		selectedElement: text({ italic: true }),
		effectiveTs: { italic: true },
		onUpdateTextStyle: vi.fn<() => void>(),
		...overrides,
	};
}
