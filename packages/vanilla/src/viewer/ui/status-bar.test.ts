import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { StatusBarHandlers } from './status-bar';
import { createStatusBar } from './status-bar';

function makeHandlers(): StatusBarHandlers {
	return {
		toggleNotes: vi.fn(),
		normalView: vi.fn(),
		openSlideSorter: vi.fn(),
		togglePresentation: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		zoomToFit: vi.fn(),
	};
}

const t = createTranslator();
function open(handlers = makeHandlers(), hidden?: Parameters<typeof createStatusBar>[3]) {
	const bar = createStatusBar(document, t, handlers, hidden);
	document.body.append(bar.el);
	const root = bar.el.shadowRoot!;
	const button = (key: string) =>
		root.querySelector<HTMLButtonElement>(`button[aria-label="${t(key)}"]`)!;
	return { bar, root, button, handlers };
}

describe('createStatusBar', () => {
	it('omitting hiddenActions renders notes, slide show, and the zoom cluster (backward compatible default)', () => {
		const { button } = open();
		expect(button('pptx.statusBar.toggleNotes').hidden).toBeFalsy();
		expect(button('pptx.statusBar.slideShow').hidden).toBeFalsy();
		expect(button('pptx.statusBar.zoomToFit').closest('.group')).toHaveProperty('hidden', false);
	});

	it("hides the notes toggle on 'notes' without affecting zoom/fullscreen", () => {
		const { button } = open(makeHandlers(), ['notes']);
		expect(button('pptx.statusBar.toggleNotes').hidden).toBeTruthy();
		expect(button('pptx.statusBar.zoomToFit').closest('.group')).toHaveProperty('hidden', false);
		expect(button('pptx.statusBar.slideShow').hidden).toBeFalsy();
	});

	it("hides the slide-show toggle on 'fullscreen'", () => {
		expect(
			open(makeHandlers(), ['fullscreen']).button('pptx.statusBar.slideShow').hidden,
		).toBeTruthy();
	});

	it("hides the whole zoom cluster on 'zoom' and update() still works", () => {
		const { bar, button } = open(makeHandlers(), ['zoom']);
		expect(button('pptx.statusBar.zoomToFit').closest('.group')).toHaveProperty('hidden', true);
		expect(() => bar.update({ current: 0, total: 3, zoomPercent: 150 })).not.toThrow();
		expect(button('pptx.statusBar.zoomToFit').closest('.group')).toHaveProperty('hidden', true);
	});

	it('reflects the slide counter and zoom percent', () => {
		const { bar, root, button } = open();
		bar.update({ current: 1, total: 9, zoomPercent: 150 });
		expect(root.querySelector('.counter')!.textContent).toBe('Slide 2 of 9');
		expect(button('pptx.statusBar.zoomToFit').textContent).toBe('150%');
		bar.update({ current: 0, total: 0, zoomPercent: 100 });
		expect(root.querySelector('.counter')!.textContent).toBe('No slides');
	});

	it('routes every control to its handler', () => {
		const { button, handlers } = open();
		for (const key of [
			'toggleNotes',
			'normalView',
			'slideSorter',
			'slideShow',
			'zoomOut',
			'zoomToFit',
			'zoomIn',
		]) {
			button(`pptx.statusBar.${key}`).click();
		}
		for (const fn of Object.values(handlers)) {
			expect(fn).toHaveBeenCalledOnce();
		}
	});

	it('keeps the Notes, Normal and Slide Show pressed state in sync', () => {
		const { bar, button } = open();
		expect(button('pptx.statusBar.toggleNotes').getAttribute('aria-pressed')).toBe('false');
		expect(button('pptx.statusBar.normalView').getAttribute('aria-pressed')).toBe('true');
		bar.setNotesExpanded(true);
		bar.setPresenting(true);
		expect(button('pptx.statusBar.toggleNotes').getAttribute('aria-pressed')).toBe('true');
		expect(button('pptx.statusBar.normalView').getAttribute('aria-pressed')).toBe('false');
		expect(button('pptx.statusBar.slideShow').getAttribute('aria-pressed')).toBe('true');
	});

	it('shows pushed autosave labels, then falls back to the dirty/saved text', () => {
		const { bar, root } = open();
		const save = root.querySelector('.save')!;
		expect(save.textContent).toBe(t('pptx.statusBar.allSaved'));
		bar.setDirty(true);
		expect(save.textContent).toBe(t('pptx.statusBar.unsavedChanges'));
		bar.setSaveStatus('Saving...', 'saving');
		expect(save.textContent).toBe('Saving...');
		expect(save.classList.contains('saving')).toBeTruthy();
		bar.setSaveStatus('', 'idle');
		expect(save.textContent).toBe(t('pptx.statusBar.unsavedChanges'));
	});

	it('projects the collaboration element into the named slot', () => {
		const collab = document.createElement('span');
		const bar = createStatusBar(document, t, makeHandlers(), undefined, collab);
		expect(bar.el.contains(collab)).toBeTruthy();
		expect(collab.slot).toBe('collaboration');
	});
});
