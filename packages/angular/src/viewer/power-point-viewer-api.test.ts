/**
 * The Angular viewer's conformance to the cross-binding `PowerPointViewerAPI`.
 *
 * React (`types-ui.ts`), Vue (`PowerPointViewer.vue`), Svelte (`deck-api.ts`)
 * and Vanilla (`PptxViewerInstance extends PowerPointViewerAPI`) all state their
 * imperative surface in terms of the shared contract. Angular stated none, so
 * nothing stopped a member from being renamed, retyped or dropped here while the
 * other four kept it: its `getMode()` / `setMode()` had already widened to
 * `string`, which is not the shared `ViewerMode`.
 *
 * The class now declares `implements PowerPointViewerAPI`, so the compiler is
 * the real guard. This spec pins the declaration itself (a source-text check,
 * since this package has no TestBed) and enumerates the members, so deleting the
 * clause to "fix" a build fails loudly instead of silently.
 */
import { computed, signal, Injector, runInInjectionContext } from '@angular/core';
import { PptxHandler, createTextElement } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { buildInlineTextCommitPatch } from '../internal/shared';
import { componentSource } from './component-source.test-support';
import { EditorStateService } from './editor-state.service';
import { ExportService } from './export.service';
import { LoadContentService } from './load-content.service';
import { PowerPointViewerComponent } from './power-point-viewer.component';
import { ViewerFileIOService } from './viewer-file-io.service';

const source = componentSource(import.meta.dirname, 'power-point-viewer.component.ts');

/** Every member of the shared `PowerPointViewerAPI`, in declaration order. */
const API_MEMBERS = [
	'getContent',
	'goTo',
	'goPrev',
	'goNext',
	'undo',
	'redo',
	'canUndo',
	'canRedo',
	'getZoom',
	'setZoom',
	'zoomIn',
	'zoomOut',
	'zoomReset',
	'getMode',
	'setMode',
	'getActiveSlideIndex',
	'setActiveSlideIndex',
	'getSlideCount',
	'isDirty',
	'getSlides',
	'getSlide',
	'getActiveSlide',
	'addSlide',
	'deleteSlides',
	'duplicateSlides',
	'moveSlide',
	'toggleHideSlides',
	'getElements',
	'getElementById',
	'updateElement',
	'deleteElements',
	'duplicateElement',
	'getSelectedElementIds',
	'selectElements',
	'clearSelection',
] as const;

describe('powerPointViewerComponent API conformance', () => {
	it('declares the shared contract, so the compiler checks it', () => {
		expect(source).toContain(
			'export class PowerPointViewerComponent implements PowerPointViewerAPI',
		);
	});

	it('implements every member of the contract as a public method', () => {
		const missing = API_MEMBERS.filter(
			(member) => !new RegExp(`\\n\\t(?:async )?${member}\\(`, 'u').test(source),
		);
		expect(missing).toStrictEqual([]);
	});

	// The one thing the declaration turned up: both mode accessors were typed
	// `string`, so a caller could set a mode the union does not contain and the
	// `modeChange` output told hosts nothing about which values to expect.
	it('types the mode accessors and the mode output as ViewerMode', () => {
		expect(source).toContain('getMode(): ViewerMode {');
		expect(source).toContain('setMode(mode: ViewerMode): void {');
		expect(source).toContain('readonly modeChange = output<ViewerMode>();');
	});
});

describe('public viewer mode transitions', () => {
	function harness() {
		const permission = signal(true);
		const editingRequested = signal(true);
		const presenting = signal(false);
		const showMasterView = signal(false);
		const blur = vi.fn();
		const state = {
			editingRequested,
			canEdit: computed(() => permission() && editingRequested()),
			presentationMode: { presenting, present: () => presenting.set(true) },
			showMasterView,
			editor: { editTemplateMode: signal(false), setEditTemplateMode: vi.fn() },
			mainEl: () => ({ nativeElement: { querySelector: () => ({ blur }) } }),
			openMasterView: () => showMasterView.set(true),
			modeChange: { emit: vi.fn() },
		};
		const target = state as unknown as PowerPointViewerComponent;
		const getMode = () => PowerPointViewerComponent.prototype.getMode.call(target);
		return {
			state,
			permission,
			blur,
			getMode,
			setMode: (mode: 'edit' | 'preview' | 'present' | 'master') =>
				PowerPointViewerComponent.prototype.setMode.call(target, mode),
		};
	}

	it('switches edit to preview and back without changing host permission', () => {
		const h = harness();
		h.setMode('preview');
		expect(h.getMode()).toBe('preview');
		expect(h.state.canEdit()).toBeFalsy();
		expect(h.permission()).toBeTruthy();
		h.setMode('edit');
		expect(h.getMode()).toBe('edit');
	});

	it('commits the current inline editor before disabling editing', () => {
		const h = harness();
		h.blur.mockImplementation(() => {
			expect(h.state.canEdit()).toBeTruthy();
		});
		h.setMode('preview');
		expect(h.blur).toHaveBeenCalledOnce();
	});

	it('does not bypass effective permission when entering edit', () => {
		const h = harness();
		h.permission.set(false);
		h.setMode('edit');
		expect(h.getMode()).toBe('preview');
	});

	it.each(['present', 'master'] as const)('returns from %s to preview', (mode) => {
		const h = harness();
		h.setMode(mode);
		expect(h.getMode()).toBe(mode);
		h.setMode('preview');
		expect(h.getMode()).toBe('preview');
	});

	it('uses permission, not interaction mode, to select the edited display and native save', () => {
		expect(source).toContain(
			'this.hasEditPermission() ? this.editor.slides() : this.loader.slides()',
		);
		const fileIoBinding = source.slice(source.indexOf('this.fileIO.bind({'));
		expect(fileIoBinding).toMatch(/canEdit: \(\) => this\.hasEditPermission\(\)/u);
	});

	it('saves committed text from the editor in preview, retaining Undo/Redo', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		const target = createTextElement('Original mode text', {
			x: 20,
			y: 30,
			width: 200,
			height: 50,
		});
		data.slides[0].elements.push(target);
		const originalBytes = await handler.save(data.slides);
		const editor = new EditorStateService();
		editor.setSlides(data.slides);
		const h = harness();
		h.blur.mockImplementation(() => {
			editor.updateElement(0, target.id, buildInlineTextCommitPatch(target, 'Pending mode text')!);
		});
		const loader = {
			saveSlides: vi.fn((slides: PptxSlide[]) => handler.save(slides)),
			getContent: vi.fn(async () => originalBytes),
		};
		const injector = Injector.create({
			providers: [
				{ provide: LoadContentService, useValue: loader },
				{ provide: ExportService, useValue: {} },
				ViewerFileIOService,
			],
		});
		const fileIO = runInInjectionContext(injector, () => injector.get(ViewerFileIOService));
		fileIO.bind({
			canEdit: h.permission,
			content: () => originalBytes,
			onOpenFile: () => undefined,
			slides: editor.slides,
			sections: editor.sections,
			templateElementsBySlideId: editor.templateElementsBySlideId,
			emitContentChange: vi.fn(),
			saveIntent: () => ({}),
			afterSuccessfulSave: vi.fn(),
		});
		h.setMode('preview');
		expect(h.getMode()).toBe('preview');
		const saved = await fileIO.getContent();
		expect(loader.getContent).not.toHaveBeenCalled();
		const reopened = await new PptxHandler().load(saved);
		expect(
			reopened.slides[0].elements.some(
				(element) => 'text' in element && element.text === 'Pending mode text',
			),
		).toBeTruthy();
		h.setMode('edit');
		editor.undo();
		expect(editor.slides()[0].elements[0]).toMatchObject({ text: 'Original mode text' });
		editor.redo();
		expect(editor.slides()[0].elements[0]).toMatchObject({ text: 'Pending mode text' });
	});
});
