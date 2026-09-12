// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
/**
 * Ribbon controls that are addressable by an accessible NAME.
 *
 * A ribbon button whose only text is the value it currently holds ("Segoe UI",
 * "24") announces the state of the deck rather than the control it is, so a
 * screen reader user, and every spec that addresses controls by role+name,
 * cannot find it. The same goes for a bare number input whose caption is a
 * plain <span> rather than a <label>. These three had that defect, and they are
 * the sort that comes back the moment someone reformats the markup, so they get
 * their own file rather than a line inside `Toolbar.test.tsx`.
 *
 * The i18n mock falls back the way the demos' i18next instance does
 * (`parseMissingKeyHandler: keyToLabel`), so a key with no dictionary entry
 * renders the label a real browser would show.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const entry = translationsEn[key];
			if (entry === undefined) {
				return keyToLabel(key);
			}
			return opts
				? entry.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: entry;
		},
	}),
}));

const { HomeSection } = await import('./HomeSection');
const { AnimationsSection } = await import('./AnimationsSection');
const { HelpSection } = await import('./HelpSection');
const { TextSection } = await import('./TextSection');

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

describe('list command state', () => {
	const renderLists = (selectedElement: PptxElement | null, canEdit = true): string =>
		render(
			React.createElement(TextSection, {
				selectedElement,
				canEdit,
				onUpdateTextStyle: vi.fn(),
				onTransformTextCase: vi.fn(),
			}),
		);
	const button = (html: string, name: string): string =>
		html.match(new RegExp(`<button[^>]*title="${name}"[^>]*>`))?.[0] ?? '';
	const listed: PptxElement = {
		type: 'text',
		id: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		textSegments: [
			{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
			{ text: 'Item', style: {} },
		],
	};

	it('announces loaded semantic bullets without a legacy listType flag', () => {
		const html = renderLists(listed);
		expect(button(html, 'Bullet List')).toContain('aria-pressed="true"');
		expect(button(html, 'Numbered List')).toContain('aria-pressed="false"');
	});

	it('disables list commands for missing selection, read-only mode and table cells', () => {
		for (const html of [
			renderLists(null),
			renderLists(listed, false),
			renderLists({ type: 'table', id: 'table', x: 0, y: 0, width: 100, height: 80 }),
		]) {
			expect(button(html, 'Bullet List')).toContain('disabled=""');
			expect(button(html, 'Numbered List')).toContain('disabled=""');
		}
	});

	it('tracks real selection changes and uses the selected paragraph for state and click intent', async () => {
		const mixed: PptxElement = {
			...listed,
			textSegments: [
				{ text: 'Plain', style: {} },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
				{ text: 'Listed', style: {} },
			],
		};
		const target = document.createElement('div');
		const editor = document.createElement('div');
		editor.dataset.inlineEditor = '';
		editor.innerHTML =
			'<span data-seg-idx="0">Plain</span><span data-seg-idx="1">\n</span><span data-seg-idx="2">◆ </span><span data-seg-idx="3">Listed</span>';
		document.body.append(target, editor);
		const root = createRoot(target);
		const update = vi.fn();
		const draw = async (element: PptxElement | null, canEdit = true) => {
			await act(async () =>
				root.render(
					React.createElement(TextSection, {
						selectedElement: element,
						canEdit,
						onUpdateTextStyle: update,
						onTransformTextCase: vi.fn(),
					}),
				),
			);
		};
		const select = async (index: number) => {
			const node = editor.querySelector(`[data-seg-idx="${index}"]`)!.firstChild!;
			const range = document.createRange();
			range.setStart(node, 0);
			range.setEnd(node, 2);
			await act(async () => {
				window.getSelection()!.removeAllRanges();
				window.getSelection()!.addRange(range);
				document.dispatchEvent(new Event('selectionchange'));
			});
		};
		try {
			await draw(mixed);
			const bullet = target.querySelector<HTMLButtonElement>('button[title="Bullet List"]')!;
			expect(bullet.getAttribute('aria-pressed')).toBe('false');
			await select(3);
			expect(bullet.getAttribute('aria-pressed')).toBe('true');
			await act(async () => bullet.click());
			expect(update).toHaveBeenLastCalledWith({ listType: 'none' });
			await select(0);
			expect(bullet.getAttribute('aria-pressed')).toBe('false');
			await act(async () => bullet.click());
			expect(update).toHaveBeenLastCalledWith({ listType: 'bullet' });
			update.mockClear();
			await draw(mixed, false);
			await select(3);
			expect(bullet.disabled).toBeTruthy();
			await act(async () => bullet.click());
			expect(update).not.toHaveBeenCalled();
			await draw(null);
			expect(bullet.disabled).toBeTruthy();
			expect(bullet.getAttribute('aria-pressed')).toBe('false');
		} finally {
			await act(async () => root.unmount());
			window.getSelection()?.removeAllRanges();
			target.remove();
			editor.remove();
		}
	});
});

describe('home tab font controls', () => {
	const html = render(
		React.createElement(HomeSection, {
			canEdit: true,
			clipboardPayload: null,
			onCopy: vi.fn<() => void>(),
			onCut: vi.fn<() => void>(),
			onPaste: vi.fn<() => void>(),
			layoutOptions: [],
			onInsertSlideFromLayout: vi.fn<() => void>(),
			selectedElement: null,
			onUpdateTextStyle: vi.fn<() => void>(),
		}),
	);

	it('names the font-family picker after the control, not its current value', () => {
		expect(html).toContain('aria-label="Font family"');
		// Still shows the value; it just no longer IS the name.
		expect(html).toContain('Segoe UI');
	});

	it('names the font-size picker after the control, not its current value', () => {
		expect(html).toContain('aria-label="Font size"');
		expect(html).toContain('>24</span>');
	});
});

describe('animations tab timing fields', () => {
	it('names the duration input, whose caption is a span rather than a label', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('aria-label="Duration"');
	});
});

describe('help tab', () => {
	it('offers Settings, which angular, vanilla and svelte already did', () => {
		const html = render(
			React.createElement(HelpSection, {
				onOpenSettings: vi.fn<() => void>(),
				onToggleShortcuts: vi.fn<() => void>(),
				onRunAccessibilityCheck: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('>Settings</button>');
		expect(html).toContain('>Keyboard Shortcuts</button>');
		expect(html).toContain('>Accessibility Check</button>');
	});
});
