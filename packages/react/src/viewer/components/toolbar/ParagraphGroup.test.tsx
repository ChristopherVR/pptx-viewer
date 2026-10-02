import { registerPptxWebControls } from 'pptx-viewer-shared';
// @vitest-environment happy-dom
/**
 * Home > Paragraph and Editing: the shared strips reflect state; this binding
 * keeps the native text-style edits and the find-panel toggle.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditingSection } from './EditingSection';
import { ParagraphGroup } from './ParagraphGroup';
import type { ParagraphGroupProps } from './ParagraphGroup';

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

const button = (id: string) =>
	container.querySelector<HTMLButtonElement>(`[data-ribbon-control="${id}"]`)!;

function props(overrides: Partial<ParagraphGroupProps> = {}): ParagraphGroupProps {
	return {
		canMut: true,
		canFormat: true,
		bulletKind: 'none',
		effectiveTs: { align: 'center', paragraphMarginLeft: 30 },
		onToggleBullets: vi.fn<() => void>(),
		onUpdateTextStyle: vi.fn<() => void>(),
		...overrides,
	};
}

describe('paragraph group', () => {
	it('reflects the explicit alignment as pressed and gates on a formattable selection', () => {
		act(() => root.render(<ParagraphGroup {...props()} />));
		expect(button('home.paragraph.alignCenter').getAttribute('aria-pressed')).toBe('true');
		expect(button('home.paragraph.alignLeft').getAttribute('aria-pressed')).toBe('false');
		expect(button('home.paragraph.justify').disabled).toBeFalsy();
		act(() => root.render(<ParagraphGroup {...props({ canMut: false })} />));
		expect(button('home.paragraph.justify').disabled).toBeTruthy();
		act(() => root.render(<ParagraphGroup {...props({ effectiveTs: {} })} />));
		expect(button('home.paragraph.alignLeft').hasAttribute('aria-pressed')).toBeFalsy();
	});

	it('applies alignment and clamped indent steps through the native text-style edit', () => {
		const p = props();
		act(() => root.render(<ParagraphGroup {...p} />));
		act(() => button('home.paragraph.alignRight').click());
		expect(p.onUpdateTextStyle).toHaveBeenLastCalledWith({ align: 'right' });
		act(() => button('home.paragraph.increaseIndent').click());
		expect(p.onUpdateTextStyle).toHaveBeenLastCalledWith({ paragraphMarginLeft: 54 });
		act(() => button('home.paragraph.decreaseIndent').click());
		expect(p.onUpdateTextStyle).toHaveBeenLastCalledWith({ paragraphMarginLeft: 6 });
		const flat = props({ effectiveTs: { paragraphMarginLeft: 10 } });
		act(() => root.render(<ParagraphGroup {...flat} />));
		act(() => button('home.paragraph.decreaseIndent').click());
		expect(flat.onUpdateTextStyle).toHaveBeenLastCalledWith({ paragraphMarginLeft: 0 });
	});

	it('does not edit when the selection cannot be formatted', () => {
		const p = props({ canFormat: false });
		act(() => root.render(<ParagraphGroup {...p} />));
		act(() => button('home.paragraph.alignLeft').click());
		expect(p.onUpdateTextStyle).not.toHaveBeenCalled();
	});
});

describe('paragraph menus and lists', () => {
	const select = (id: string, value: string) => {
		const field = container.querySelector<HTMLElement & { value: string }>(
			`[data-ribbon-control="${id}"]`,
		)!;
		field.value = value;
		act(() => void field.dispatchEvent(new Event('change', { bubbles: true })));
	};
	const toggle = (id: string) =>
		container.querySelector<HTMLButtonElement>(`[data-ribbon-control="${id}"] button`)!;

	it('runs line spacing, direction and columns through the text-style edit', () => {
		const p = props();
		act(() => root.render(<ParagraphGroup {...p} />));
		select('home.paragraph.lineSpacing', '1.5');
		expect(p.onUpdateTextStyle).toHaveBeenLastCalledWith({ lineSpacing: 1.5 });
		select('home.paragraph.textDirection', 'vertical');
		expect(p.onUpdateTextStyle).toHaveBeenLastCalledWith({ textDirection: 'vertical' });
		select('home.paragraph.columns', '3');
		expect(p.onUpdateTextStyle).toHaveBeenLastCalledWith({ columnCount: 3 });
	});

	it('toggles bullets and numbering and reflects the list kind', () => {
		const p = props({ bulletKind: 'numbered' });
		act(() => root.render(<ParagraphGroup {...p} />));
		expect(toggle('home.paragraph.numbering').getAttribute('aria-pressed')).toBe('true');
		expect(toggle('home.paragraph.bullets').getAttribute('aria-pressed')).toBe('false');
		act(() => toggle('home.paragraph.bullets').click());
		expect(p.onToggleBullets).toHaveBeenLastCalledWith('bullet');
		act(() => toggle('home.paragraph.numbering').click());
		expect(p.onToggleBullets).toHaveBeenLastCalledWith('numbered');
	});

	it('hosts the library galleries inside the toggle wrappers', () => {
		act(() => root.render(<ParagraphGroup {...props()} />));
		for (const id of ['bullets', 'numbering']) {
			const slot = container.querySelector(`[data-ribbon-control="home.paragraph.${id}"]`)!;
			expect(slot.querySelector('pptx-ui-ribbon-gallery')).not.toBeNull();
		}
	});

	it('does nothing for a menu pick when the selection cannot be formatted', () => {
		const p = props({ canFormat: false });
		act(() => root.render(<ParagraphGroup {...p} />));
		select('home.paragraph.columns', '2');
		expect(p.onUpdateTextStyle).not.toHaveBeenCalled();
	});
});

describe('editing section', () => {
	it('opens the find panel from both Find and Replace', () => {
		const onToggleFindReplace = vi.fn<() => void>();
		act(() => root.render(<EditingSection onToggleFindReplace={onToggleFindReplace} />));
		act(() => button('home.editing.find').click());
		act(() => button('home.editing.replace').click());
		expect(onToggleFindReplace).toHaveBeenCalledTimes(2);
		expect(container.querySelector('[data-ribbon-group="home.editing"]')).not.toBeNull();
		expect(container.querySelector('[data-ribbon-control="home.editing.select"]')).not.toBeNull();
	});

	it('runs Select All from the shared Select menu and disables it without a handler', () => {
		const onSelectAll = vi.fn<() => void>();
		act(() =>
			root.render(<EditingSection onToggleFindReplace={vi.fn()} onSelectAll={onSelectAll} />),
		);
		const slot = container.querySelector<HTMLElement>(
			'[data-ribbon-control="home.editing.select"]',
		)!;
		act(() => slot.querySelector('button')!.click());
		act(() => slot.querySelector<HTMLElement>('[role="menuitem"]')!.click());
		expect(onSelectAll).toHaveBeenCalledOnce();
		act(() => root.render(<EditingSection onToggleFindReplace={vi.fn()} />));
		expect(slot.querySelector('button')!.disabled).toBeTruthy();
	});
});
