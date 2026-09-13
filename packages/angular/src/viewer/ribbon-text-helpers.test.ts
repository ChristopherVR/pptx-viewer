import { Injector, runInInjectionContext, signal } from '@angular/core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { elementBulletKind } from '../internal/shared';
import { remapTextToSegments } from '../internal/shared-src/render/remap-text';
import { componentSource } from './component-source.test-support';
import { EditorStateService } from './editor-state.service';
import { RibbonParagraphControlsComponent } from './ribbon-paragraph-controls.component';
import { patchTextStyle, transformSelectedTextCase } from './ribbon-text-helpers';

function textElement(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hello world',
		textStyle: { fontSize: 18 },
		textSegments: [{ text: 'hello world', style: { fontSize: 18 } }],
	} as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements };
}

function service(el: PptxElement): EditorStateService {
	const svc = new EditorStateService();
	svc.setSlides([slide([el])]);
	return svc;
}

describe('patchTextStyle list commands', () => {
	it.each(['bullet', 'numbered'])('retains native editor focus before the %s command', (kind) => {
		const source = componentSource(import.meta.dirname, 'ribbon-paragraph-controls.component.ts');
		const button = [...source.matchAll(/<button\b[^>]*>/gu)].find(([markup]) =>
			markup.includes(`(click)="toggleList('${kind}')"`),
		)?.[0];
		expect(button).toBeDefined();
		expect(button).toContain('(mousedown)="$event.preventDefault()"');
		expect(button).toContain('[disabled]="!canEdit() || !isText()"');
	});

	it('does not commit a rich format when the current surface rejects it', () => {
		const source = textElement();
		const svc = service(source);
		const snapshot = {
			elementId: source.id,
			text: 'Current',
			textSegments: [{ text: 'Current', style: {} }],
		};
		patchTextStyle(svc, 0, source, { bold: true }, snapshot, () => false);
		expect(svc.slides()[0].elements[0]).toStrictEqual(source);
		expect(svc.canUndo()).toBeFalsy();
	});

	it('paints current rich formatting before making its undoable model change', () => {
		const source = textElement();
		const svc = service(source);
		const snapshot = {
			elementId: source.id,
			text: 'Current',
			textSegments: [{ text: 'Current', style: { italic: true } }],
		};
		let painted = false;
		patchTextStyle(svc, 0, source, { bold: true }, snapshot, (next) => {
			expect(svc.slides()[0].elements[0]).toStrictEqual(source);
			expect(next.textSegments?.[0].style).toMatchObject({ italic: true, bold: true });
			painted = true;
			return true;
		});
		expect(painted).toBeTruthy();
		expect(svc.slides()[0].elements[0]).toMatchObject({
			text: 'Current',
			textSegments: [{ style: { bold: true, italic: true } }],
		});
		svc.undo();
		expect(svc.slides()[0].elements[0]).toStrictEqual(source);
	});

	it('uses the current rich draft for a font change without losing its list level', () => {
		const source = textElement();
		const svc = service(source);
		const snapshot = {
			elementId: source.id,
			text: 'Current body',
			textSegments: [{ text: 'Current body', style: { italic: true }, paragraphLevel: 1 }],
		};
		patchTextStyle(svc, 0, source, { bold: true }, snapshot);
		expect(svc.slides()[0].elements[0]).toMatchObject({
			text: 'Current body',
			textStyle: { bold: true },
			textSegments: [{ text: 'Current body', style: { italic: true }, paragraphLevel: 1 }],
		});
	});

	it('guards list buttons in read-only mode even when a text selection remains', () => {
		class Controls extends RibbonParagraphControlsComponent {
			applyList(): void {
				this.toggleList('bullet');
			}
		}
		const original = textElement();
		const svc = service(original);
		const controls = runInInjectionContext(
			Injector.create({ providers: [{ provide: EditorStateService, useValue: svc }] }),
			() => new Controls(),
		);
		const editable = signal(false);
		Object.defineProperty(controls, 'canEdit', { value: editable });
		Object.defineProperty(controls, 'selectedElement', { value: signal(original) });
		controls.applyList();
		expect(svc.slides()[0].elements[0]).toStrictEqual(original);
		editable.set(true);
		controls.applyList();
		expect(elementBulletKind(svc.slides()[0].elements[0])).toBe('bullet');
	});

	it('creates markers for plain multiline text without segments', () => {
		const source = textElement();
		if (!hasTextProperties(source)) {
			throw new Error('expected text');
		}
		delete source.textSegments;
		source.text = 'first\nsecond';
		const svc = service(source);
		patchTextStyle(svc, 0, source, { listType: 'bullet' });
		const result = svc.slides()[0].elements[0];
		if (!hasTextProperties(result)) {
			throw new Error('expected text');
		}
		expect(result.textSegments?.filter((segment) => segment.bulletInfo?.char)).toHaveLength(2);
		expect(
			result.textSegments
				?.filter((segment) => !segment.bulletInfo)
				.map((segment) => segment.text)
				.join(''),
		).toBe('first\nsecond');
	});

	it.each(['bullet', 'numbered'] as const)('sets %s semantics with one undoable update', (kind) => {
		const original = textElement();
		const svc = service(original);
		patchTextStyle(svc, 0, svc.slides()[0].elements[0], { listType: kind, bold: true });
		const listed = svc.slides()[0].elements[0];
		expect(elementBulletKind(listed)).toBe(kind);
		if (!hasTextProperties(listed)) {
			throw new Error('expected text');
		}
		expect(listed.textSegments?.[0].bulletInfo).toBeDefined();
		expect(
			listed.textSegments
				?.slice(1)
				.map((segment) => segment.text)
				.join(''),
		).toBe('hello world');
		expect(listed.textStyle?.bold).toBeTruthy();
		svc.undo();
		expect(svc.slides()[0].elements[0]).toStrictEqual(original);
		svc.redo();
		expect(svc.slides()[0].elements[0]).toStrictEqual(listed);
		patchTextStyle(svc, 0, listed, { listType: kind });
		expect(svc.slides()[0].elements[0]).toStrictEqual(listed);
		patchTextStyle(svc, 0, svc.slides()[0].elements[0], { listType: 'none' });
		expect(elementBulletKind(svc.slides()[0].elements[0])).toBe('none');
	});

	it('keeps pending textarea content when creating a list', () => {
		const editor = document.createElement('textarea');
		editor.dataset.inlineEditor = '';
		editor.value = 'hello world, typed more';
		document.body.appendChild(editor);
		try {
			const svc = service(textElement());
			patchTextStyle(svc, 0, svc.slides()[0].elements[0], { listType: 'bullet' });
			const result = svc.slides()[0].elements[0];
			if (!hasTextProperties(result)) {
				throw new Error('expected text');
			}
			expect(result.text).toBe(editor.value);
			expect(
				result.textSegments
					?.slice(1)
					.map((segment) => segment.text)
					.join(''),
			).toBe(editor.value);
		} finally {
			editor.remove();
		}
	});

	it('ignores absent selections and unsupported tables', () => {
		const table: PptxElement = {
			id: 'table',
			type: 'table',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			tableData: { rows: [{ cells: [{ text: 'cell', style: {} }] }], columnWidths: [1] },
		};
		const svc = service(table);
		patchTextStyle(svc, 0, null, { listType: 'bullet' });
		patchTextStyle(svc, 0, table, { listType: 'bullet' });
		expect(svc.slides()[0].elements[0]).toStrictEqual(table);
	});
});

describe('transformSelectedTextCase', () => {
	it('ends the native list session before changing body characters without changing its marker', () => {
		const source = textElement();
		const svc = service(source);
		const snapshot = {
			elementId: source.id,
			text: 'lower',
			textSegments: [
				{
					text: 'iii. ',
					style: {},
					bulletInfo: { autoNumType: 'romanLcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
				},
				{ text: 'lower', style: { italic: true } },
			],
		};
		const end = vi.fn(() => {
			expect(svc.slides()[0].elements[0]).toStrictEqual(source);
		});
		transformSelectedTextCase(svc, 0, source, 'upper', snapshot, end);
		expect(end).toHaveBeenCalledOnce();
		expect(svc.slides()[0].elements[0]).toMatchObject({
			text: 'LOWER',
			textSegments: [{ text: 'iii. ' }, { text: 'LOWER', style: { italic: true } }],
		});
		svc.undo();
		expect(svc.slides()[0].elements[0]).toStrictEqual(source);
	});

	it.each([false, true])(
		'honors explicit formatting before runless typing (with list=%s)',
		(withList) => {
			const initial = {
				...textElement(),
				text: '',
				textSegments: [
					{
						text: '',
						style: {},
						paragraphInsertionStyle: { bold: true, color: '#007000', fontSize: 40 },
					},
				],
			} as PptxElement;
			const svc = service(initial);
			const updates = { bold: false, color: '#000000', fontSize: 24 };
			patchTextStyle(svc, 0, initial, {
				...updates,
				...(withList ? { listType: 'numbered' as const } : {}),
			});
			const element = svc.slides()[0].elements[0] as PptxElement & { textSegments: TextSegment[] };
			const typed = remapTextToSegments('Typed', element.textSegments, {});
			expect(typed.at(-1)?.style).toMatchObject(updates);
			expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
		},
	);

	it('rewrites run text per a change-case mode', () => {
		const svc = service(textElement());
		transformSelectedTextCase(svc, 0, svc.slides()[0].elements[0], 'upper');

		const el = svc.slides()[0].elements[0] as PptxElement & {
			text?: string;
			textSegments?: Array<{ text: string }>;
		};
		expect(el.textSegments?.[0].text).toBe('HELLO WORLD');
		expect(el.text).toBe('HELLO WORLD');
	});

	it('reconciles against a live open inline editor before transforming case', () => {
		// The inline-edit `<textarea data-inline-editor>` is uncontrolled: text
		// typed since the edit session began is not yet on the model's
		// `textSegments`/`text`. Regression: previously the case transform ran
		// against that stale snapshot, leaving anything typed since
		// untransformed once the edit session committed.
		const editor = document.createElement('textarea');
		editor.dataset.inlineEditor = '';
		editor.value = 'hello world, typed more';
		document.body.appendChild(editor);
		try {
			const svc = service(textElement()); // model still says "hello world"
			transformSelectedTextCase(svc, 0, svc.slides()[0].elements[0], 'upper');

			const el = svc.slides()[0].elements[0] as PptxElement & {
				text?: string;
				textSegments?: Array<{ text: string }>;
			};
			expect(el.textSegments?.map((s) => s.text).join('')).toBe('HELLO WORLD, TYPED MORE');
			expect(el.text).toBe('HELLO WORLD, TYPED MORE');
		} finally {
			editor.remove();
		}
	});
});
