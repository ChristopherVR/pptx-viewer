/**
 * Edit Points and the Freeform: Shape / Curve tools, Angular binding.
 *
 * No full-viewer TestBed (see `vitest.config.ts`): each piece is constructed
 * inside an injector parented on the TestBed injector (effects need its
 * scheduler, flushed with `TestBed.tick()`), inputs are replaced by signals,
 * and pointer handlers are called with synthetic events. Unrendered, the
 * overlay measures a 0x0 rect, so client pixels ARE slide pixels here.
 *
 * Reference binding: packages/react/src/viewer/components/canvas/EditPointsOverlay.tsx
 */
import { ElementRef, Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef, Provider, StaticProvider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { CanvasSize, EditPointsView, FreeformToolKind } from '../internal/shared';
import type { EditPointsCommit } from './edit-points-overlay.component';
import { EditPointsOverlayComponent } from './edit-points-overlay.component';
import { EditorContextMenuComponent } from './editor-context-menu.component';
import { EditorStateService } from './editor-state.service';
import { FreeformToolOverlayComponent } from './freeform-tool-overlay.component';
import { OutlineAuthoringService } from './outline-authoring.service';
import { RibbonFreeformToolsComponent } from './ribbon-freeform-tools.component';
import { ViewerCustomizationService } from './viewer-customization.service';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';
import { ViewerOptionsService } from './viewer-options.service';

const CANVAS: CanvasSize = { width: 960, height: 540 };

function rect(extra: Partial<ShapePptxElement> = {}): ShapePptxElement {
	return {
		id: 'r1',
		type: 'shape',
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		shapeType: 'rect',
		...extra,
	};
}

beforeAll(() => {
	try {
		TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	} catch {
		// Already initialised by another spec in this worker.
	}
});
/** Every injector made, destroyed after each test so no overlay keeps its window listener. */
const injectors: Injector[] = [];
afterEach(() => {
	for (const injector of injectors.splice(0)) {
		(injector as Injector & { destroy?: () => void }).destroy?.();
	}
	TestBed.resetTestingModule();
});

function makeInjector(extra: (Provider | StaticProvider)[] = []): Injector {
	const injector = Injector.create({
		parent: TestBed.inject(Injector),
		providers: [
			{ provide: ViewerOptionsService, deps: [] },
			{ provide: ViewerCustomizationService, deps: [] },
			{ provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
			...extra,
		],
	});
	injectors.push(injector);
	return injector;
}

function editorWith(element: PptxElement): EditorStateService {
	const editor = new EditorStateService();
	editor.setSlides([{ id: 's1', rId: 'r1', slideNumber: 1, elements: [element] }]);
	editor.selectedIds.set([element.id]);
	return editor;
}

/** A synthetic pointer event aimed at the given edit-points target id. */
function pointer(x: number, y: number, target: string | null, button = 0): PointerEvent {
	const el = document.createElement('div');
	if (target) {
		el.setAttribute('data-pptx-edit-points-target', target);
	}
	return {
		clientX: x,
		clientY: y,
		button,
		ctrlKey: false,
		metaKey: false,
		pointerId: 1,
		target: el,
		currentTarget: null,
		stopPropagation: () => undefined,
		preventDefault: () => undefined,
	} as unknown as PointerEvent;
}

function contextMenu(element: PptxElement) {
	const editor = editorWith(element);
	const injector = makeInjector([
		{ provide: EditorStateService, useValue: editor },
		{ provide: ViewerInspectorPanelService, useValue: {} },
		{ provide: OutlineAuthoringService, useFactory: () => new OutlineAuthoringService(), deps: [] },
	]);
	const outline = injector.get(OutlineAuthoringService);
	const menu = runInInjectionContext(injector, () => new EditorContextMenuComponent());
	Object.defineProperty(menu, 'slideIndex', { value: () => 0 });
	const internals = menu as unknown as {
		entries: () => { id: string; disabled?: boolean }[];
		run: (id: string) => void;
	};
	return { outline, internals };
}

describe('edit points context-menu entry', () => {
	it('is offered for a shape and starts Edit Points', () => {
		const { outline, internals } = contextMenu(rect());
		const entry = internals.entries().find((e) => e.id === 'edit-points');
		expect(entry).toBeDefined();
		expect(entry?.disabled).toBeFalsy();
		internals.run('edit-points');
		expect(outline.editPointsElementId()).toBe('r1');
	});

	it('is greyed out for a noEditPoints lock', () => {
		const { outline, internals } = contextMenu(rect({ locks: { noEditPoints: true } }));
		expect(internals.entries().find((e) => e.id === 'edit-points')?.disabled).toBeTruthy();
		internals.run('edit-points');
		expect(outline.editPointsElementId()).toBeNull();
	});
});

interface OverlayInternals {
	view: () => EditPointsView;
	onPointerDown: (event: PointerEvent) => void;
	onPointerMove: (event: PointerEvent) => void;
	onPointerUp: (event: PointerEvent) => void;
}

function editPointsOverlay(element: PptxElement) {
	const overlay = runInInjectionContext(makeInjector(), () => new EditPointsOverlayComponent());
	Object.assign(overlay, {
		element: signal(element) as unknown as InputSignal<PptxElement>,
		canvasSize: signal(CANVAS) as unknown as InputSignal<CanvasSize>,
		scale: signal(1) as unknown as InputSignal<number>,
		hiddenCommands: signal(undefined) as unknown as InputSignal<undefined>,
	});
	const commits: EditPointsCommit[] = [];
	vi.spyOn(overlay.commit as OutputEmitterRef<EditPointsCommit>, 'emit').mockImplementation((c) => {
		commits.push(c);
	});
	const exit = vi.spyOn(overlay.exit as OutputEmitterRef<void>, 'emit').mockImplementation(() => {
		/* recorded */
	});
	TestBed.tick();
	return { overlay: overlay as unknown as OverlayInternals, commits, exit };
}

describe('edit points overlay', () => {
	it('draws a target for every vertex and segment of the shape', () => {
		const { overlay } = editPointsOverlay(rect());
		const view = overlay.view();
		expect(view.nodes.map((n) => n.target)).toStrictEqual([
			'node:0:0',
			'node:0:1',
			'node:0:2',
			'node:0:3',
		]);
		expect(view.segments).toHaveLength(4);
	});

	it('commits a custom-geometry patch when a vertex is dragged', () => {
		const { overlay, commits } = editPointsOverlay(rect());
		overlay.onPointerDown(pointer(300, 200, 'node:0:2'));
		overlay.onPointerMove(pointer(350, 240, null));
		overlay.onPointerUp(pointer(350, 240, null));
		expect(commits).toHaveLength(1);
		expect(commits[0].id).toBe('r1');
		expect(commits[0].patch).toMatchObject({ shapeType: 'custom', width: 250, height: 140 });
	});

	it('leaves the mode on Escape', () => {
		const { exit } = editPointsOverlay(rect());
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(exit).toHaveBeenCalledOnce();
	});
});

describe('freeform drawing tools', () => {
	it('arms and disarms from the Insert tab', () => {
		const injector = makeInjector([
			{
				provide: OutlineAuthoringService,
				useFactory: () => new OutlineAuthoringService(),
				deps: [],
			},
		]);
		const outline = injector.get(OutlineAuthoringService);
		outline.editPointsElementId.set('r1');
		const buttons = runInInjectionContext(injector, () => new RibbonFreeformToolsComponent());
		const internals = buttons as unknown as {
			tools: () => FreeformToolKind[];
			toggle: (tool: FreeformToolKind) => void;
		};
		expect(internals.tools()).toStrictEqual(['freeformShape', 'curve']);
		internals.toggle('curve');
		expect(outline.activeFreeformTool()).toBe('curve');
		expect(outline.editPointsElementId()).toBeNull();
		internals.toggle('curve');
		expect(outline.activeFreeformTool()).toBeNull();
	});

	it('inserts a closed custom shape from clicks on the capture overlay', () => {
		const overlay = runInInjectionContext(makeInjector(), () => new FreeformToolOverlayComponent());
		Object.assign(overlay, {
			tool: signal<FreeformToolKind>('freeformShape') as unknown as InputSignal<FreeformToolKind>,
			canvasSize: signal(CANVAS) as unknown as InputSignal<CanvasSize>,
			scale: signal(1) as unknown as InputSignal<number>,
		});
		const inserted: ShapePptxElement[] = [];
		vi.spyOn(overlay.commit as OutputEmitterRef<ShapePptxElement>, 'emit').mockImplementation(
			(el) => {
				inserted.push(el);
			},
		);
		TestBed.tick();
		const internals = overlay as unknown as {
			onPointerDown: (e: PointerEvent) => void;
			onPointerUp: (e: PointerEvent) => void;
			onDoubleClick: (e: MouseEvent) => void;
		};
		const click = (x: number, y: number) => {
			internals.onPointerDown(pointer(x, y, null));
			internals.onPointerUp(pointer(x, y, null));
		};
		click(100, 100);
		click(200, 100);
		click(150, 180);
		internals.onDoubleClick(pointer(150, 180, null));
		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({ type: 'shape', shapeType: 'custom', x: 100, y: 100 });
	});
});

describe('outline authoring service', () => {
	it('hides the edited shape from the canvas selection only while editing', () => {
		const editor = editorWith(rect());
		const injector = makeInjector([{ provide: EditorStateService, useValue: editor }]);
		const outline = runInInjectionContext(injector, () => new OutlineAuthoringService());
		expect(outline.canvasSelectedIds()).toStrictEqual(['r1']);
		outline.startEditPoints(rect());
		expect(outline.canvasSelectedIds()).toStrictEqual([]);
		outline.exitEditPoints();
		expect(outline.canvasSelectedIds()).toStrictEqual(['r1']);
	});
});
