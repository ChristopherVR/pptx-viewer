import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * ole-editor-dialog.component.test.ts: the "Edit content" dialog for
 * embedded OLE objects (spreadsheet grid / document paragraphs / nested-deck
 * slide titles, plus Replace File). Ports the scenarios from React's
 * `OleEditorDialog.test.tsx` (real minimal xlsx/docx payloads via JSZip, no
 * mocking of `pptx-viewer-core`), adapted to this package's harness.
 *
 * `OleEditorDialogComponent`'s constructor runs an `effect()` that needs a
 * `ChangeDetectionScheduler` / effect scheduler this package's TestBed-free
 * suite doesn't provide by default (see `table-renderer.component.drilldown.
 * test.ts`), so this follows `autosave-recovery.service.test.ts`'s harness
 * instead: a bare `Injector` supplying stub `ChangeDetectionScheduler` and
 * `EffectScheduler` providers, with a manual `flush()` to run queued effects
 * on demand. That gives the real reactive load-on-open behaviour, not just
 * the pure helpers.
 */
import {
	DestroyRef,
	Injector,
	runInInjectionContext,
	signal,
	ɵChangeDetectionScheduler as ChangeDetectionScheduler,
	ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import JSZip from 'jszip';
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
import { oleBytesToDataUrl, PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { OleEditorDialogComponent } from './ole-editor-dialog.component';

const COMPONENT_SOURCE = readFileSync(
	path.join(__dirname, 'ole-editor-dialog.component.ts'),
	'utf8',
);

interface SchedulableEffect {
	run(): void;
}

/** Same bare-injector harness as `autosave-recovery.service.test.ts` (no TestBed here). */
function harness(
	element: OlePptxElement,
	open = true,
): {
	component: OleEditorDialogComponent;
	flush: () => void;
	patches: Partial<PptxElement>[];
	closeCount: () => number;
} {
	const queued = new Set<SchedulableEffect>();
	const effects = {
		add: (effect: SchedulableEffect) => queued.add(effect),
		schedule: (effect: SchedulableEffect) => queued.add(effect),
		remove: (effect: SchedulableEffect) => queued.delete(effect),
		flush: () => {
			for (const effect of [...queued]) {
				queued.delete(effect);
				effect.run();
			}
		},
	};
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } },
			{ provide: ChangeDetectionScheduler, useValue: { notify: () => {} } },
			{ provide: EffectScheduler, useValue: effects },
		],
	});
	const component = runInInjectionContext(injector, () => new OleEditorDialogComponent());
	Object.assign(component, {
		open: signal(open) as unknown as InputSignal<boolean>,
		element: signal(element) as unknown as InputSignal<OlePptxElement>,
	});
	const patches: Partial<PptxElement>[] = [];
	vi.spyOn(component.patch as OutputEmitterRef<Partial<PptxElement>>, 'emit').mockImplementation(
		(value) => {
			patches.push(value);
		},
	);
	let closes = 0;
	vi.spyOn(component.close as OutputEmitterRef<void>, 'emit').mockImplementation(() => {
		closes += 1;
	});
	return { component, flush: effects.flush, patches, closeCount: () => closes };
}

/** Flush the harness's queued effect, then let its fire-and-forget async load settle. */
async function flushAndSettle(flush: () => void): Promise<void> {
	flush();
	for (let i = 0; i < 10; i++) {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
	}
}

async function makeXlsxElement(): Promise<OlePptxElement> {
	const zip = new JSZip();
	zip.file(
		'xl/workbook.xml',
		'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>',
	);
	zip.file(
		'xl/worksheets/sheet1.xml',
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>10</v></c></row></sheetData></worksheet>',
	);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return {
		id: 'ole1',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'excel',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		),
	};
}

async function makeDocxElement(): Promise<OlePptxElement> {
	const zip = new JSZip();
	zip.file(
		'word/document.xml',
		'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>',
	);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return {
		id: 'ole2',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'word',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		),
	};
}

async function makeDeckElement(): Promise<OlePptxElement> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({ initialSlideCount: 0 });
	data.slides.push(
		createSlide('Blank')
			.addText('Nested Title', { fontSize: 32, x: 0, y: 0, width: 400, height: 60 })
			.addText('Nested Body', { fontSize: 18, x: 0, y: 80, width: 400, height: 60 })
			.build(),
	);
	const bytes = await handler.save(data.slides);
	return {
		id: 'ole3',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'powerpoint',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		),
	};
}

function makePdfElement(): OlePptxElement {
	return {
		id: 'ole4',
		type: 'ole',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		oleObjectType: 'pdf',
		oleEmbeddedData: oleBytesToDataUrl(new Uint8Array([1, 2, 3]), 'application/pdf'),
	};
}

describe('oleEditorDialogComponent load-on-open', () => {
	it('does not load anything while closed', async () => {
		const element = await makeXlsxElement();
		const { component, flush } = harness(element, false);
		await flushAndSettle(flush);
		expect(component['grid']()).toBeUndefined();
		expect(component['loading']()).toBeFalsy();
	});

	it('loads and edits a spreadsheet cell, committing an oleContentDirty patch', async () => {
		const element = await makeXlsxElement();
		const { component, flush, patches } = harness(element);
		await flushAndSettle(flush);

		const grid = component['grid']();
		expect(grid?.rows[0]?.cells[0]?.value).toBe('10');

		await (
			component as unknown as {
				onCellEdit: (edit: { row: number; col: number; value: string }) => Promise<void>;
			}
		).onCellEdit({ row: 0, col: 0, value: '250' });

		expect(patches).toHaveLength(1);
		expect(patches[0]).toMatchObject({
			oleContentDirty: true,
			oleEmbeddedData: expect.stringMatching(/^data:/) as unknown as string,
		});
		expect(component['grid']()?.rows[0]?.cells[0]?.value).toBe('250');
	});

	it('does not commit a patch when the cell value is unchanged (blur without edit)', async () => {
		const element = await makeXlsxElement();
		const { component, flush, patches } = harness(element);
		await flushAndSettle(flush);

		await (
			component as unknown as {
				onCellEdit: (edit: { row: number; col: number; value: string }) => Promise<void>;
			}
		).onCellEdit({ row: 0, col: 0, value: '10' });

		expect(patches).toHaveLength(0);
	});

	it('loads document paragraphs into the paragraphs signal', async () => {
		const element = await makeDocxElement();
		const { component, flush } = harness(element);
		await flushAndSettle(flush);
		expect(component['paragraphs']()).toStrictEqual(['Hello']);
	});

	it('edits a document paragraph, committing an oleContentDirty patch', async () => {
		const element = await makeDocxElement();
		const { component, flush, patches } = harness(element);
		await flushAndSettle(flush);

		await (
			component as unknown as {
				onParagraphEdit: (edit: { index: number; text: string }) => Promise<void>;
			}
		).onParagraphEdit({ index: 0, text: 'Goodbye' });

		expect(patches).toHaveLength(1);
		expect(patches[0]).toMatchObject({ oleContentDirty: true });
		expect(component['paragraphs']()).toStrictEqual(['Goodbye']);
	});

	it('loads every text-bearing shape on every nested-deck slide, and edits one specifically', async () => {
		const element = await makeDeckElement();
		const { component, flush, patches } = harness(element);

		// A nested-deck load runs the full PptxHandler load/save pipeline
		// (slower than a plain xlsx/docx JSZip parse), so poll rather than
		// assume a fixed number of ticks settles it.
		for (let i = 0; i < 20 && component['deckSlides']() === undefined; i++) {
			await flushAndSettle(flush);
		}

		const slides = component['deckSlides']();
		expect(slides?.[0]?.elements.map((e) => e.text)).toStrictEqual(['Nested Title', 'Nested Body']);
		const bodyElementId = slides![0]!.elements[1]!.elementId;

		await (
			component as unknown as {
				onDeckElementEdit: (edit: {
					slideIndex: number;
					elementId: string;
					text: string;
				}) => Promise<void>;
			}
		).onDeckElementEdit({ slideIndex: 0, elementId: bodyElementId, text: 'Edited Body' });

		expect(patches).toHaveLength(1);
		expect(patches[0]).toMatchObject({ oleContentDirty: true });
		expect(component['deckSlides']()?.[0]?.elements.map((e) => e.text)).toStrictEqual([
			'Nested Title',
			'Edited Body',
		]);
	});

	it('offers no content tab for a plain (non-editable) payload kind', async () => {
		const element = makePdfElement();
		const { component, flush } = harness(element);
		await flushAndSettle(flush);
		expect(component['descriptor']().contentTab).toBeUndefined();
		expect(component['grid']()).toBeUndefined();
		expect(component['paragraphs']()).toBeUndefined();
		expect(component['deckSlides']()).toBeUndefined();
	});
});

describe('oleEditorDialogComponent replace file', () => {
	it('always renders the Replace File action, unconditionally of the content tab', () => {
		// The footer (file input + Replace File / Save buttons) sits outside the
		// `@switch` on `descriptor().contentTab?.kind`, so it renders regardless
		// of payload kind (mirrors React's OleEditorDialog: "always offers the
		// Replace File action, even for an unsupported kind").
		expect(COMPONENT_SOURCE).toContain("'pptx.ole.editDialog.replaceFile' | translate");
		expect(COMPONENT_SOURCE).toContain('<div footer');
		expect(COMPONENT_SOURCE).toContain('triggerFileInput()');
	});

	it('replaces the file, commits a dirty patch, and closes the dialog', async () => {
		const element = makePdfElement();
		const { component, flush, patches, closeCount } = harness(element);
		await flushAndSettle(flush);

		const replacementZip = new JSZip();
		replacementZip.file(
			'xl/workbook.xml',
			'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>',
		);
		const replacementBytes = await replacementZip.generateAsync({ type: 'uint8array' });
		const file = new File([replacementBytes], 'new.xlsx');

		await (component as unknown as { replaceFile: (f: File) => Promise<void> }).replaceFile(file);

		expect(patches).toHaveLength(1);
		expect(patches[0]).toMatchObject({ oleContentDirty: true });
		expect(closeCount()).toBe(1);
	});
});

describe('oleEditorDialogComponent shell wiring', () => {
	it('composes pptx-modal-dialog with the descriptor title and requestClose', () => {
		expect(COMPONENT_SOURCE).toContain('<pptx-modal-dialog');
		expect(COMPONENT_SOURCE).toContain('[title]="descriptor().titleKey | translate"');
		expect(COMPONENT_SOURCE).toContain('(close)="requestClose()"');
	});

	it('mounts a per-kind editor for sheet/document/deck via the shared descriptor', () => {
		expect(COMPONENT_SOURCE).toContain('pptx-ole-sheet-grid-editor');
		expect(COMPONENT_SOURCE).toContain('pptx-ole-document-editor');
		expect(COMPONENT_SOURCE).toContain('pptx-ole-deck-editor');
		expect(COMPONENT_SOURCE).toContain("'pptx.ole.editDialog.unsupported' | translate");
	});

	it('imports shared through the vendored barrel, never the bare specifier', () => {
		expect(COMPONENT_SOURCE).toContain("from '../internal/shared'");
		expect(COMPONENT_SOURCE).not.toContain("from 'pptx-viewer-shared'");
	});
});
