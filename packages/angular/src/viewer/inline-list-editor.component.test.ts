import { DestroyRef, ElementRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInlineListSeed } from '../internal/shared';
import { InlineListEditorComponent } from './inline-list-editor.component';
import { InlineListSession } from './inline-list-session';

// Direct component lifecycle and native DOM events, not Angular TestBed or browser Undo.
function mountedEditor(activationSelection?: { start: number; end: number }) {
	const element: PptxElement = {
		id: 'list',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: '◆ Original',
		textSegments: [
			{ text: '◆ ', style: {}, bulletInfo: { char: '◆' }, paragraphLevel: 1 },
			{ text: 'Original', style: { italic: true, fontSize: 24 } },
		],
	};
	const root = document.createElement('div');
	root.contentEditable = 'true';
	document.body.append(root);
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } }],
	});
	const component = runInInjectionContext(injector, () => new InlineListEditorComponent());
	const seed = createInlineListSeed(element)!;
	Object.assign(component, {
		element: () => element,
		seed: () => seed,
		activationSelection: () => activationSelection,
		editor: () => new ElementRef(root),
	});
	const inputs = vi.spyOn(component.textInput, 'emit');
	const commits = vi.spyOn(component.textCommit, 'emit');
	const sessions = vi.spyOn(component.listSession, 'emit');
	component.ngAfterViewInit();
	const handlers = component as unknown as {
		commit(): void;
		onKeyDown(event: KeyboardEvent): void;
	};
	return {
		root,
		component,
		handlers,
		inputs,
		commits,
		sessions,
		cleanup: () => {
			component.ngOnDestroy();
			root.remove();
		},
	};
}

describe('angular list editor', () => {
	it('toggles inherited underline off when its first run has no authored underline', () => {
		const editor = mountedEditor();
		const format = vi.spyOn(editor.component.textFormat, 'emit');
		try {
			Object.assign(editor.component.element(), { textStyle: { underline: true } });
			editor.handlers.onKeyDown(new KeyboardEvent('keydown', { key: 'u', ctrlKey: true }));
			expect(format).toHaveBeenCalledWith({ id: 'list', updates: { underline: false } });
			editor.handlers.onKeyDown(new KeyboardEvent('keydown', { key: 'i', ctrlKey: true }));
			expect(format).toHaveBeenLastCalledWith({ id: 'list', updates: { italic: false } });
		} finally {
			editor.cleanup();
		}
	});

	it('restores textarea body selection when an explicit command activates the list surface', () => {
		const editor = mountedEditor({ start: 2, end: 5 });
		try {
			expect(window.getSelection()?.toString()).toBe('igi');
			expect(window.getSelection()?.anchorOffset).toBe(2);
			expect(window.getSelection()?.focusOffset).toBe(5);
		} finally {
			editor.cleanup();
		}
	});

	it('reconciles same-body style Undo and immediate pending-save reads without awaiting Angular rendering', () => {
		const editor = mountedEditor();
		const source = editor.component.element();
		let model = source;
		const retired = vi.fn();
		const session = new InlineListSession(() => model, retired);
		session.register(editor.sessions.mock.lastCall![0]);
		try {
			const original = session.read()!;
			const formatted = {
				...original,
				textSegments: original.textSegments!.map((segment) => ({
					...segment,
					style: { ...segment.style, bold: true },
				})),
			};
			expect(session.format(formatted)).toBeTruthy();
			model = { ...source, textSegments: formatted.textSegments };
			model = source; // Undo before any input/render/read has observed the formatted model.
			expect(
				session.read()?.textSegments?.find((segment) => segment.text === 'Original')?.style.bold,
			).not.toBeTruthy();
			expect(editor.root.querySelector('span')!.style.fontWeight).not.toBe('bold');
			editor.root.querySelector('span')!.textContent = 'Current';
			editor.root.dispatchEvent(new Event('input'));
			const draft = session.read()!;
			expect(session.format(draft)).toBeTruthy();
			model = { ...source, text: draft.text, textSegments: draft.textSegments };
			model = source;
			expect(session.read()).toBeUndefined();
			expect(retired).toHaveBeenCalledOnce();
		} finally {
			editor.cleanup();
		}
	});

	it('ends a stale model-history session without committing it, but retains geometry-only changes', () => {
		const editor = mountedEditor();
		const source = editor.component.element();
		const cancel = vi.spyOn(editor.component.textCancel, 'emit');
		try {
			editor.root.querySelector('span')!.textContent = 'Current';
			editor.root.dispatchEvent(new Event('input'));
			Object.assign(editor.component, { element: () => ({ ...source, x: 20 }) });
			editor.component.ngOnChanges();
			expect(cancel).not.toHaveBeenCalled();
			const snapshot = editor.inputs.mock.lastCall![0].snapshot!;
			Object.assign(editor.component, {
				element: () => ({ ...source, text: snapshot.text, textSegments: snapshot.textSegments }),
			});
			editor.component.ngOnChanges();
			expect(cancel).not.toHaveBeenCalled();
			Object.assign(editor.component, { element: () => source });
			editor.component.ngOnChanges();
			expect(cancel).toHaveBeenCalledOnce();
			editor.handlers.commit();
			expect(editor.commits).not.toHaveBeenCalled();
		} finally {
			editor.cleanup();
		}
	});

	it('reads typed list runs and commits the same semantic snapshot', () => {
		const editor = mountedEditor();
		try {
			const run = editor.root.querySelector('span')!;
			run.textContent = 'Current';
			editor.root.dispatchEvent(new Event('input'));
			expect(editor.inputs.mock.lastCall?.[0]).toMatchObject({
				text: 'Current',
				snapshot: {
					elementId: 'list',
					textSegments: expect.arrayContaining([
						expect.objectContaining({
							text: 'Current',
							style: expect.objectContaining({ italic: true }),
						}),
					]),
				},
			});
			editor.handlers.commit();
			expect(editor.commits.mock.lastCall?.[0].snapshot).toStrictEqual(
				editor.inputs.mock.lastCall?.[0].snapshot,
			);
			expect(editor.root.querySelector('span')).toBe(run);
		} finally {
			editor.cleanup();
		}
	});

	it('keeps Enter as commit and Shift+Enter as a native paragraph command, ignoring IME', () => {
		const editor = mountedEditor();
		const previous = Object.getOwnPropertyDescriptor(document, 'execCommand');
		const command = vi.fn(() => true);
		Object.defineProperty(document, 'execCommand', { configurable: true, value: command });
		const blur = vi.spyOn(editor.component, 'blur');
		try {
			editor.handlers.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
			expect(command).toHaveBeenCalledExactlyOnceWith('insertParagraph');
			expect(blur).not.toHaveBeenCalled();
			editor.handlers.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
			expect(blur).not.toHaveBeenCalled();
			editor.handlers.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
			expect(blur).toHaveBeenCalledOnce();
		} finally {
			if (previous) {
				Object.defineProperty(document, 'execCommand', previous);
			} else {
				Reflect.deleteProperty(document, 'execCommand');
			}
			editor.cleanup();
		}
	});

	it('rejects old callbacks after the same element gets a different seed', () => {
		const editor = mountedEditor();
		try {
			editor.inputs.mockClear();
			Object.assign(editor.component, { seed: () => ({ elementId: 'list', paragraphs: [] }) });
			editor.root.dispatchEvent(new Event('input'));
			expect(editor.inputs).not.toHaveBeenCalled();
		} finally {
			editor.cleanup();
		}
	});
});
