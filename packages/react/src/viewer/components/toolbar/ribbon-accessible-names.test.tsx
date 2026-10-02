// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import { registerPptxWebControls } from 'pptx-viewer-shared';
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
const { HelpSection } = await import('./HelpSection');
const { TextSection } = await import('./TextSection');

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

registerPptxWebControls();

/** Mount into the document so the shared elements render their own buttons. */
async function mountInto(element: React.ReactElement) {
	const target = document.createElement('div');
	document.body.append(target);
	const root = createRoot(target);
	await act(async () => root.render(element));
	return {
		target,
		unmount: async () => {
			await act(async () => root.unmount());
			target.remove();
		},
	};
}

describe('list command state', () => {
	const renderLists = async (selectedElement: PptxElement | null, canEdit = true) =>
		mountInto(
			React.createElement(TextSection, {
				selectedElement,
				canEdit,
				onUpdateTextStyle: vi.fn(),
				onToggleBullets: vi.fn(),
				onTransformTextCase: vi.fn(),
			}),
		);
	const button = (target: HTMLElement, name: string) =>
		target.querySelector<HTMLButtonElement>(`button[title="${name}"]`)!;
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

	it('announces loaded semantic bullets without a legacy listType flag', async () => {
		const { target, unmount } = await renderLists(listed);
		expect(button(target, 'Bullet List').getAttribute('aria-pressed')).toBe('true');
		expect(button(target, 'Numbered List').getAttribute('aria-pressed')).toBe('false');
		await unmount();
	});

	it('disables list commands for missing selection and read-only mode', async () => {
		for (const [element, canEdit] of [
			[null, true],
			[listed, false],
		] as const) {
			const { target, unmount } = await renderLists(element, canEdit);
			expect(button(target, 'Bullet List').disabled).toBeTruthy();
			expect(button(target, 'Numbered List').disabled).toBeTruthy();
			await unmount();
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
		const toggle = vi.fn();
		const draw = async (element: PptxElement | null, canEdit = true) => {
			await act(async () =>
				root.render(
					React.createElement(TextSection, {
						selectedElement: element,
						canEdit,
						onUpdateTextStyle: update,
						onToggleBullets: toggle,
						onTransformTextCase: vi.fn(),
					}),
				),
			);
		};
		const select = async (index: number, collapsed = false) => {
			const node = editor.querySelector(`[data-seg-idx="${index}"]`)!.firstChild!;
			const range = document.createRange();
			range.setStart(node, 0);
			range.setEnd(node, collapsed ? 0 : 2);
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
			await select(3, true);
			expect(bullet.getAttribute('aria-pressed')).toBe('true');
			await act(async () => bullet.click());
			expect(toggle).toHaveBeenLastCalledWith('bullet');
			expect(update).not.toHaveBeenCalled();
			await select(0);
			expect(bullet.getAttribute('aria-pressed')).toBe('false');
			await act(async () => bullet.click());
			expect(toggle).toHaveBeenLastCalledWith('bullet');
			expect(update).not.toHaveBeenCalled();
			toggle.mockClear();
			await draw(mixed, false);
			await select(3);
			expect(bullet.disabled).toBeTruthy();
			await act(async () => bullet.click());
			expect(update).not.toHaveBeenCalled();
			expect(toggle).not.toHaveBeenCalled();
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
	const mountHome = () =>
		mountInto(
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

	it('names the font-family picker after the control, not its current value', async () => {
		const { target, unmount } = await mountHome();
		const family = target.querySelector<HTMLElement>('[data-font-picker="family"]')!;
		expect(family.getAttribute('aria-label')).toBe('Font family');
		// Still shows the value; it just no longer IS the name.
		expect((family as HTMLElement & { value: string }).value).toBe('Segoe UI');
		await unmount();
	});

	it('names the font-size picker after the control, not its current value', async () => {
		const { target, unmount } = await mountHome();
		const size = target.querySelector<HTMLElement>('[data-font-picker="size"]')!;
		expect(size.getAttribute('aria-label')).toBe('Font size');
		expect((size as HTMLElement & { value: string }).value).toBe('24');
		await unmount();
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
		for (const label of ['Settings', 'Keyboard Shortcuts', 'Accessibility Check']) {
			expect(html).toContain(`<pptx-ui-ribbon-command label="${label}"`);
		}
	});
});
