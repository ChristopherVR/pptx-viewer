import {
	DestroyRef,
	Injector,
	runInInjectionContext,
	signal,
	ɵChangeDetectionScheduler as ChangeDetectionScheduler,
	ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import type { ImagePptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { INSERT_CHART_TYPES } from '../internal/shared';
import { createImageElementFromFile } from '../internal/shared-src/render/image-file-insertion';
import {
	newChartElement,
	newEquationElement,
	newShapeElement,
	newSmartArtElement,
	newTableElement,
	newTextElement,
} from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { setupViewerImagePaste } from './viewer-image-paste';

vi.mock(import('../internal/shared-src/render/image-file-insertion'), () => ({
	createImageElementFromFile: vi.fn(),
}));

describe('newTextElement', () => {
	it('returns type "text"', () => {
		expect(newTextElement().type).toBe('text');
	});

	it('leaves id as empty string', () => {
		expect(newTextElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newTextElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newTextElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newTextElement(250, 300);
		expect(el.x).toBe(250);
		expect(el.y).toBe(300);
	});

	it('carries non-empty text content', () => {
		const el = newTextElement();
		expect(el.type).toBe('text');
		// Narrow to access text-specific field.
		if (el.type === 'text') {
			expect(el.text).toBeTypeOf('string');
			expect((el.text ?? '').length).toBeGreaterThan(0);
		}
	});
});

describe('newShapeElement', () => {
	it('returns type "shape"', () => {
		expect(newShapeElement('rect').type).toBe('shape');
	});

	it('leaves id as empty string', () => {
		expect(newShapeElement('ellipse').id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newShapeElement('rect');
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('preserves the shapeType for rect', () => {
		const el = newShapeElement('rect');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('rect');
		}
	});

	it('preserves the shapeType for ellipse', () => {
		const el = newShapeElement('ellipse');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('ellipse');
		}
	});

	it('preserves the shapeType for line', () => {
		const el = newShapeElement('line');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('line');
		}
	});

	it('accepts custom x/y overrides', () => {
		const el = newShapeElement('rect', 400, 200);
		expect(el.x).toBe(400);
		expect(el.y).toBe(200);
	});

	it('uses sensible default position when no args given', () => {
		const el = newShapeElement('ellipse');
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});
});

describe('newTableElement', () => {
	it('returns type "table"', () => {
		expect(newTableElement().type).toBe('table');
	});

	it('leaves id as empty string', () => {
		expect(newTableElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newTableElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newTableElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newTableElement(3, 3, 200, 300);
		expect(el.x).toBe(200);
		expect(el.y).toBe(300);
	});

	it('produces tableData with the requested row and column counts', () => {
		const el = newTableElement(4, 5);
		if (el.type === 'table') {
			expect(el.tableData?.rows).toHaveLength(4);
			for (const row of el.tableData?.rows ?? []) {
				expect(row.cells).toHaveLength(5);
			}
		}
	});

	it('column widths sum to 1 (approximately)', () => {
		const el = newTableElement(3, 4);
		if (el.type === 'table') {
			const total = (el.tableData?.columnWidths ?? []).reduce((a, b) => a + b, 0);
			expect(total).toBeCloseTo(1, 5);
		}
	});

	it('sets firstRowHeader on tableData', () => {
		const el = newTableElement();
		if (el.type === 'table') {
			expect(el.tableData?.firstRowHeader).toBeTruthy();
		}
	});

	it('uses default 3×3 grid when called with no arguments', () => {
		const el = newTableElement();
		if (el.type === 'table') {
			expect(el.tableData?.rows.length).toBe(3);
			expect(el.tableData?.rows[0]?.cells.length).toBe(3);
		}
	});
});

describe('newSmartArtElement', () => {
	it('returns type "smartArt"', () => {
		expect(newSmartArtElement().type).toBe('smartArt');
	});

	it('leaves id as empty string', () => {
		expect(newSmartArtElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newSmartArtElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newSmartArtElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newSmartArtElement(250, 350);
		expect(el.x).toBe(250);
		expect(el.y).toBe(350);
	});

	it('produces smartArtData with at least one node', () => {
		const el = newSmartArtElement();
		if (el.type === 'smartArt') {
			expect(el.smartArtData?.nodes.length).toBeGreaterThan(0);
		}
	});

	it('sets layout to basicBlockList', () => {
		const el = newSmartArtElement();
		if (el.type === 'smartArt') {
			expect(el.smartArtData?.layout).toBe('basicBlockList');
		}
	});

	it('assigns unique node ids', () => {
		const el = newSmartArtElement();
		if (el.type === 'smartArt') {
			const ids = el.smartArtData?.nodes.map((n) => n.id) ?? [];
			expect(new Set(ids).size).toBe(ids.length);
		}
	});
});

describe('newEquationElement', () => {
	it('returns type "shape" (equation rendered via textSegments)', () => {
		expect(newEquationElement().type).toBe('shape');
	});

	it('leaves id as empty string', () => {
		expect(newEquationElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newEquationElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newEquationElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newEquationElement(300, 400);
		expect(el.x).toBe(300);
		expect(el.y).toBe(400);
	});

	it('carries at least one textSegment with equationXml', () => {
		const el = newEquationElement();
		if (el.type === 'shape') {
			expect(el.textSegments).toBeDefined();
			expect(el.textSegments?.length).toBeGreaterThan(0);
			const firstSeg = el.textSegments?.[0];
			expect(firstSeg?.equationXml).toBeDefined();
			expect(firstSeg?.equationXml).toBeTypeOf('object');
		}
	});

	it('has non-empty fallback text', () => {
		const el = newEquationElement();
		if (el.type === 'shape') {
			expect((el.text ?? '').length).toBeGreaterThan(0);
		}
	});
});

describe('newChartElement', () => {
	it('offers Pareto in the dropdown and inserts a valid histogram+cumulative-percent chart (docs/guide/limitations.md ChartEx row)', () => {
		const pareto = INSERT_CHART_TYPES.find((opt) => opt.id === 'pareto');
		expect(pareto).toBeDefined();
		expect(pareto?.type).toBe('histogram');

		const el = newChartElement('pareto');
		expect(el.type).toBe('chart');
		expect(el.id).toBe('');
		if (el.type === 'chart') {
			expect(el.chartData?.chartType).toBe('histogram');
			expect(el.chartData?.series).toHaveLength(2);
			expect(el.chartData?.series?.[1].histogramOptions?.layout).toBe('pareto');
		}
	});
});

describe('native image paste insertion', () => {
	const image: ImagePptxElement = {
		id: 'pasted-image',
		type: 'image',
		x: 20,
		y: 30,
		width: 80,
		height: 40,
		imageData: 'data:image/png;base64,cGljdHVyZQ==',
	};
	const cleanups: (() => void)[] = [];

	// Match autosave.service.test.ts: this suite has no TestBed rendering setup,
	// so a bare injector explicitly flushes Angular's queued lifecycle effects.
	function harness() {
		const root = document.createElement('div');
		const main = document.createElement('main');
		const canvas = document.createElement('div');
		canvas.className = 'pptx-ng-canvas-stage';
		main.append(canvas);
		root.append(main);
		document.body.append(root);
		const loadedSlides = signal<PptxSlide[]>([
			{ id: 'slide-1', elements: [] },
			{ id: 'slide-2', elements: [] },
		]);
		const loader = {
			slides: loadedSlides,
			loading: signal(false),
			error: signal<string | null>(null),
			canvasSize: signal({ width: 960, height: 540 }),
		};
		const editor = new EditorStateService();
		editor.setSlides(loadedSlides());
		const index = signal(0),
			editable = signal(true),
			blocked = signal(false);
		const destroyCallbacks: (() => void)[] = [];
		const queued = new Set<{ run(): void }>();
		const scheduler = {
			add: (effect: { run(): void }) => queued.add(effect),
			schedule: (effect: { run(): void }) => queued.add(effect),
			remove: (effect: { run(): void }) => queued.delete(effect),
		};
		const flush = () => {
			for (const effect of [...queued]) {
				queued.delete(effect);
				effect.run();
			}
		};
		const injector = Injector.create({
			providers: [
				{
					provide: DestroyRef,
					useValue: {
						onDestroy: (fn: () => void) => {
							destroyCallbacks.push(fn);
							return () => {};
						},
					},
				},
				{ provide: ChangeDetectionScheduler, useValue: { notify: () => {} } },
				{ provide: EffectScheduler, useValue: scheduler },
			],
		});
		runInInjectionContext(injector, () =>
			setupViewerImagePaste(
				{
					rootElement: () => root,
					mainElement: () => main,
					canEdit: editable,
					blocked,
					activeSlide: () => editor.slides()[index()],
					activeSlideIndex: index,
				},
				loader,
				editor,
			),
		);
		flush();
		root.focus();
		let destroyed = false;
		const destroy = () => {
			if (destroyed) {
				return;
			}
			destroyed = true;
			injector.destroy();
			for (const fn of destroyCallbacks.splice(0)) {
				fn();
			}
		};
		cleanups.push(() => {
			destroy();
			root.remove();
		});
		vi.mocked(createImageElementFromFile).mockReset().mockResolvedValue(image);
		const paste = (target: HTMLElement = root) => {
			const event = new Event('paste', { bubbles: true, cancelable: true });
			Object.defineProperty(event, 'clipboardData', {
				value: {
					files: [new File(['image'], 'image.png', { type: 'image/png' })],
					items: [],
				},
			});
			target.dispatchEvent(event);
			return event;
		};
		return { root, canvas, loader, editor, index, editable, blocked, flush, destroy, paste };
	}

	afterEach(() => {
		for (const cleanup of cleanups.splice(0)) {
			cleanup();
		}
	});

	it('uses one normal editor transaction, selects the image, and supports Undo/Redo', async () => {
		const h = harness();
		expect(h.paste().defaultPrevented).toBeTruthy();
		await Promise.resolve();
		expect(createImageElementFromFile).toHaveBeenCalledWith(
			expect.any(File),
			{ width: 960, height: 540 },
			expect.any(AbortSignal),
		);
		expect(h.editor.slides()[0].elements).toStrictEqual([image]);
		expect(h.editor.selectedIds()).toStrictEqual([image.id]);
		expect(h.editor.dirty()).toBeTruthy();
		h.editor.undo();
		expect(h.editor.slides()[0].elements).toStrictEqual([]);
		expect(h.editor.canUndo()).toBeFalsy();
		h.editor.redo();
		expect(h.editor.slides()[0].elements).toStrictEqual([image]);
	});

	it('repairs native focus after a canvas shape press, without consuming an input paste', () => {
		const h = harness();
		const input = document.createElement('input');
		const shape = document.createElement('div');
		shape.addEventListener('pointerdown', (event) => event.stopPropagation());
		h.root.append(input);
		h.canvas.append(shape);
		input.focus();
		expect(h.paste(input).defaultPrevented).toBeFalsy();
		shape.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
		expect(document.activeElement).toBe(h.root);
		expect(h.paste().defaultPrevented).toBeTruthy();
	});

	it.each(['permission', 'loading', 'error', 'blocked'] as const)(
		'leaves native paste untouched while %s prevents canvas editing',
		(gate) => {
			const h = harness();
			if (gate === 'permission') {
				h.editable.set(false);
			}
			if (gate === 'loading') {
				h.loader.loading.set(true);
			}
			if (gate === 'error') {
				h.loader.error.set('load failed');
			}
			if (gate === 'blocked') {
				h.blocked.set(true);
			}
			h.flush();
			expect(h.paste().defaultPrevented).toBeFalsy();
			expect(createImageElementFromFile).not.toHaveBeenCalled();
			expect(h.root.hasAttribute('data-pptx-image-paste-root')).toBeTruthy();
		},
	);

	it.each(['slide', 'reload', 'permission', 'blocked', 'page-size', 'destroy'] as const)(
		'cancels pending decode across a %s transition, including returning before decode',
		async (change) => {
			const h = harness();
			let finish!: (value: ImagePptxElement) => void;
			vi.mocked(createImageElementFromFile).mockImplementation(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			);
			h.paste();
			const abortSignal = vi.mocked(createImageElementFromFile).mock.calls[0][2];
			if (change === 'slide') {
				h.index.set(1);
				h.flush();
				h.index.set(0);
			}
			if (change === 'reload') {
				h.loader.loading.set(true);
				h.flush();
				h.loader.loading.set(false);
			}
			if (change === 'permission') {
				h.editable.set(false);
				h.flush();
				h.editable.set(true);
			}
			if (change === 'blocked') {
				h.blocked.set(true);
				h.flush();
				h.blocked.set(false);
			}
			if (change === 'page-size') {
				h.loader.canvasSize.set({ width: 540, height: 960 });
				h.flush();
				h.loader.canvasSize.set({ width: 960, height: 540 });
			}
			if (change === 'destroy') {
				h.destroy();
			}
			h.flush();
			expect(abortSignal?.aborted).toBeTruthy();
			finish(image);
			await Promise.resolve();
			expect(h.editor.slides()[0].elements).toStrictEqual([]);
			expect(h.editor.dirty()).toBeFalsy();
			expect(h.editor.canUndo()).toBeFalsy();
		},
	);

	it('rejects a replacement document with the same slide ID before effects flush', async () => {
		const h = harness();
		let finish!: (value: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		h.paste();
		h.loader.slides.set([{ id: 'slide-1', elements: [] }]);
		finish(image);
		await Promise.resolve();
		expect(h.editor.canUndo()).toBeFalsy();
	});

	it('does not cancel a pending paste when another element changes on the same slide', async () => {
		const h = harness();
		let finish!: (value: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		h.paste();
		h.editor.addElement(0, newTextElement());
		h.flush();
		finish(image);
		await Promise.resolve();
		expect(h.editor.slides()[0].elements).toHaveLength(2);
		expect(h.editor.selectedIds()).toStrictEqual([image.id]);
	});

	it('rejects a changed page size before effects flush', async () => {
		const h = harness();
		let finish!: (value: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		h.paste();
		h.loader.canvasSize.set({ width: 960, height: 600 });
		finish(image);
		await Promise.resolve();
		expect(h.editor.canUndo()).toBeFalsy();
	});

	it('keeps a pending paste when canvas dimensions are unchanged', async () => {
		const h = harness();
		let finish!: (value: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		h.paste();
		h.loader.canvasSize.set({ width: 960, height: 540 });
		h.flush();
		finish(image);
		await Promise.resolve();
		expect(h.editor.slides()[0].elements).toStrictEqual([image]);
	});
});
