import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { translate } from '../../i18n/translator';
import NotesPanel from './NotesPanel.svelte';
import type { NotesPanelProps } from './props';

/**
 * NotesPanel tests: the plain-text speaker-notes surface. Mirrors the Vue
 * binding's plain `<textarea>` branch: seeded text, readonly-without-handler,
 * committed edits, the expand/collapse toggle, and the "don't clobber an
 * in-progress edit while the slide id is unchanged" seeding rule.
 *
 * Named `*.svelte.test.ts` (not plain `.test.ts`) so the module body can wrap
 * mounted props in `$state(...)`, keeping them reactive after `mount()` (see
 * `media-box.svelte.test.ts` for the same pattern/rationale).
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

interface MountResult {
	target: HTMLElement;
	textarea: HTMLTextAreaElement;
	setProps: (next: Partial<NotesPanelProps>) => void;
}

function mountPanel(initial: NotesPanelProps): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ ...initial });
	const instance = mount(NotesPanel, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const getTextarea = (): HTMLTextAreaElement => {
		let el = target.querySelector<HTMLTextAreaElement>('.pptx-svelte-notes-textarea');
		// The editable desktop surface starts in rich mode. These legacy plain
		// commit tests deliberately exercise the Plain toggle path.
		if (!el) {
			target
				.querySelector<HTMLButtonElement>('.pptx-svelte-notes-toolbar button:last-child')
				?.click();
			flushSync();
			el = target.querySelector<HTMLTextAreaElement>('.pptx-svelte-notes-textarea');
		}
		if (!el) {
			throw new Error('textarea not found');
		}
		return el;
	};
	return {
		target,
		get textarea(): HTMLTextAreaElement {
			return getTextarea();
		},
		setProps: (next) => {
			Object.assign(props, next);
			flushSync();
		},
	} as MountResult;
}

function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		notes: 'Remember to mention quarterly goals.',
		...overrides,
	};
}

describe('notesPanel', () => {
	it('renders the current slide notes text', () => {
		const { textarea } = mountPanel({ slide: slide(), expanded: true });
		expect(textarea.value).toBe('Remember to mention quarterly goals.');
	});

	it('prefers rich notesSegments over the plain notes fallback', () => {
		const { textarea } = mountPanel({
			slide: slide({
				notes: 'plain fallback',
				notesSegments: [
					{ text: 'Rich line one', style: {} },
					{ text: '', style: {}, isParagraphBreak: true },
					{ text: 'Rich line two', style: {} },
				],
			}),
			expanded: true,
		});
		expect(textarea.value).toBe('Rich line one\nRich line two');
	});

	it('is readonly (but not disabled) when no update handler is given', () => {
		const { textarea } = mountPanel({ slide: slide(), expanded: true });
		expect(textarea.readOnly).toBeTruthy();
		expect(textarea.disabled).toBeFalsy();
	});

	it('is disabled when there is no slide', () => {
		const { textarea } = mountPanel({ slide: undefined, expanded: true });
		expect(textarea.disabled).toBeTruthy();
	});

	it('is editable and fires the update callback on commit', () => {
		const onupdate = vi.fn();
		const { textarea } = mountPanel({ slide: slide(), expanded: true, onupdate });
		expect(textarea.readOnly).toBeFalsy();

		textarea.value = 'Updated notes text';
		textarea.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(onupdate).toHaveBeenCalledExactlyOnceWith('Updated notes text');
	});

	it('fires the update callback on blur', () => {
		const onupdate = vi.fn();
		const { textarea } = mountPanel({ slide: slide(), expanded: true, onupdate });

		textarea.value = 'Blurred edit';
		textarea.dispatchEvent(new Event('blur', { bubbles: true }));
		flushSync();

		expect(onupdate).toHaveBeenCalledExactlyOnceWith('Blurred edit');
	});

	it('does not re-seed an in-progress edit while the slide id is unchanged', () => {
		const onupdate = vi.fn();
		const { textarea, setProps } = mountPanel({ slide: slide(), expanded: true, onupdate });

		// Type without committing (no change/blur), then trigger an unrelated
		// reactive update (toggling `expanded`) on the SAME slide id.
		textarea.value = 'In-progress edit';
		setProps({ expanded: false });
		setProps({ expanded: true });

		expect(textarea.value).toBe('In-progress edit');
	});

	it('re-seeds the textarea when the slide id changes', () => {
		const { textarea, setProps } = mountPanel({ slide: slide(), expanded: true });
		expect(textarea.value).toBe('Remember to mention quarterly goals.');

		setProps({ slide: slide({ id: 'slide-2', notes: 'Second slide notes.' }) });
		expect(textarea.value).toBe('Second slide notes.');
	});

	it('collapses and expands via the header toggle', () => {
		const ontoggle = vi.fn();
		const { target } = mountPanel({ slide: slide(), expanded: false, ontoggle });
		const body = target.querySelector<HTMLElement>('#slide-notes-content');
		expect(body?.hidden).toBeTruthy();

		const header = target.querySelector<HTMLButtonElement>('.pptx-svelte-notes-header');
		header?.click();
		flushSync();
		expect(ontoggle).toHaveBeenCalledOnce();
	});

	it('shows the body when expanded is true', () => {
		const { target } = mountPanel({ slide: slide(), expanded: true });
		const body = target.querySelector<HTMLElement>('#slide-notes-content');
		expect(body?.hidden).toBeFalsy();
		expect(target.querySelector('.pptx-svelte-notes-header')?.getAttribute('aria-expanded')).toBe(
			'true',
		);
	});

	it('prints the current slide notes into a hidden iframe via the shared buildNotesPrintHtml builder', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const props = $state<NotesPanelProps>({
			slide: slide({ notes: 'Remember the demo.', slideNumber: 2 }),
			expanded: true,
			onupdate: () => {},
		});
		const instance = mount(NotesPanel, { target, props });
		flushSync();
		try {
			const printLabel = translate('en', 'pptx.notes.printNotes');
			const printButton = target.querySelector<HTMLButtonElement>(`[aria-label="${printLabel}"]`);
			expect(printButton).not.toBeNull();

			const framesBefore = document.body.querySelectorAll('iframe[aria-hidden="true"]').length;
			printButton?.click();

			const frames = document.body.querySelectorAll<HTMLIFrameElement>(
				'iframe[aria-hidden="true"]',
			);
			expect(frames).toHaveLength(framesBefore + 1);
			const frame = frames[frames.length - 1];
			expect(frame.contentDocument?.body.textContent).toContain('Remember the demo.');
			frame.remove();
		} finally {
			unmount(instance);
			target.remove();
		}
	});

	it('applies the notes master fontSize default to a plain segment with no explicit size', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const props = $state<NotesPanelProps>({
			slide: slide({ notes: 'Remember to mention quarterly goals.' }),
			expanded: true,
			// The rich contentEditable surface (which carries the resolved inline
			// styles) only renders on an editable panel, i.e. with an `onupdate`.
			onupdate: () => {},
			notesStyle: { 0: { fontSize: 32 } },
		});
		const instance = mount(NotesPanel, { target, props });
		flushSync();
		try {
			const rich = target.querySelector<HTMLDivElement>('.pptx-svelte-notes-rich');
			expect(rich).not.toBeNull();
			// notesStyle level-0 fontSize is in CSS px (32); resolveNotesLevelStyle
			// converts to points (32 * 0.75 = 24) and segmentsToEditorHtml renders
			// that as a `font-size:24pt` inline style on the seeded span.
			expect(rich?.innerHTML).toContain('font-size:24pt');
		} finally {
			unmount(instance);
			target.remove();
		}
	});
});
