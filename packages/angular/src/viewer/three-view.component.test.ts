/**
 * `<pptx-three-view>` wiring in the Angular binding (replaces the five
 * per-kind `*-chart-3d-renderer.component.test.ts` suites and the
 * scene-mount / SmartArt-model tests).
 *
 * No Angular TestBed (see `vitest.config.ts`): components are instantiated
 * directly in an injection context with inputs stubbed as signals, matching
 * `extrusion-3d-overlay.component.test.ts`. The templates are asserted as
 * source, like that suite does.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
	DestroyRef,
	Injector,
	runInInjectionContext,
	signal,
	ɵChangeDetectionScheduler as ChangeDetectionScheduler,
	ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import type { StaticProvider } from '@angular/core';
import type { PptxChartData, PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { ChartPartRef, Rendering3DFlags, ThreeViewSpec } from '../internal/shared';
import { ChartElementViewComponent } from './chart-element-view.component';
import { ChartPartSelectionService } from './chart-part-selection.service';
import { EditorStateService } from './editor-state.service';
import { DEFAULT_RENDERING_3D_FLAGS, Rendering3DService } from './rendering-3d.service';
import { SmartArt3DRendererComponent } from './smart-art-3d-renderer.component';

function read(file: string): string {
	return readFileSync(path.join(__dirname, file), 'utf8');
}

/**
 * The component constructors register `effect()`s, which need a scheduler;
 * these no-ops never run them (the tests drive the signals directly).
 */
const EFFECT_PROVIDERS: StaticProvider[] = [
	{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } },
	{ provide: ChangeDetectionScheduler, useValue: { notify: () => {} } },
	{
		provide: EffectScheduler,
		useValue: { add: () => {}, schedule: () => {}, remove: () => {}, flush: () => {} },
	},
];

function chart(chartType: PptxChartData['chartType'], id = `ch_${chartType}`): PptxElement {
	const chartData: PptxChartData = {
		chartType,
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [15, 25] },
		],
		...(chartType === 'surface' ? { view3D: { rotX: 15, rotY: 20 } } : {}),
	};
	return { id, type: 'chart', x: 0, y: 0, width: 400, height: 300, chartData } as PptxElement;
}

/** The members the tests drive (protected in the component). */
interface ChartViewInternals {
	threeSpec: () => ThreeViewSpec | null;
	canEdit: () => boolean;
	selectedPart: () => ChartPartRef | null;
	dragValue: () => number | null;
	onChartPart3DSelect: (part: ChartPartRef | null) => void;
	onChart3DValueDrag: (detail: {
		part: ChartPartRef;
		value: number;
		phase: 'move' | 'commit';
	}) => void;
}

function createChartView(
	element: PptxElement,
	flags: Partial<Rendering3DFlags>,
	options: { editable?: boolean; selected?: boolean } = {},
) {
	const rendering3D = new Rendering3DService();
	rendering3D.flags.set({ ...DEFAULT_RENDERING_3D_FLAGS, ...flags });
	const partSelection = new ChartPartSelectionService();
	const updateElement = vi.fn();
	const editor = {
		slides: signal([{ id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [element] }]),
		selectedIds: signal(options.selected ? [element.id] : []),
		updateElement,
	};
	const injector = Injector.create({
		providers: [
			...EFFECT_PROVIDERS,
			{ provide: Rendering3DService, useValue: rendering3D },
			{ provide: ChartPartSelectionService, useValue: partSelection },
			{ provide: EditorStateService, useValue: editor },
		],
	});
	const view = runInInjectionContext(injector, () => new ChartElementViewComponent());
	Object.assign(view, {
		element: signal(element),
		editable: signal(options.editable ?? false),
		animationState: signal(undefined),
	});
	return { view: view as unknown as ChartViewInternals, partSelection, updateElement };
}

const cases: Array<{ flag: keyof Rendering3DFlags; chartType: PptxChartData['chartType'] }> = [
	{ flag: 'barChart3D', chartType: 'bar3D' },
	{ flag: 'lineChart3D', chartType: 'line3D' },
	{ flag: 'areaChart3D', chartType: 'area3D' },
	{ flag: 'pieChart3D', chartType: 'pie3D' },
	{ flag: 'surfaceChart3D', chartType: 'surface' },
];

describe('chartElementViewComponent - <pptx-three-view> gating', () => {
	it.each(cases)(
		'resolves a chart spec for a $chartType chart when $flag is on',
		({ flag, chartType }) => {
			expect(createChartView(chart(chartType), { [flag]: true }).view.threeSpec()?.kind).toBe(
				'chart',
			);
		},
	);

	it.each(cases)(
		'stays on the SVG path for a $chartType chart when $flag is off',
		({ chartType }) => {
			expect(createChartView(chart(chartType), {}).view.threeSpec()).toBeNull();
		},
	);

	it.each(cases)(
		'leaves a plain 2D bar chart on the SVG path even when $flag is on',
		({ flag }) => {
			expect(createChartView(chart('bar', 'ch_2d'), { [flag]: true }).view.threeSpec()).toBeNull();
		},
	);

	it('renders the view with the SVG chart projected as its fallback', () => {
		const html = read('chart-element-view.component.html');
		expect(html).toMatch(
			/<pptx-ng-three-view[\s\S]*\[spec\]="spec"[\s\S]*\[interactive\]="canEdit\(\)"[\s\S]*\[selectedPart\]="selectedPart\(\)"[\s\S]*\[textStyle\]="chartTextStyle\(\)"[\s\S]*<pptx-chart-renderer[\s\S]*<\/pptx-ng-three-view>/,
		);
	});
});

describe('chartElementViewComponent - 3D select / drag', () => {
	const part = { role: 'dataPoint' as const, seriesIndex: 0, pointIndex: 1 };

	it('a 3D mark click selects the part through ChartPartSelectionService', () => {
		const { view, partSelection } = createChartView(
			chart('bar3D'),
			{ barChart3D: true },
			{ editable: true, selected: true },
		);
		expect(view.canEdit()).toBeTruthy();
		view.onChartPart3DSelect(part);
		expect(partSelection.selection()).toStrictEqual({ elementId: 'ch_bar3D', part });
		expect(view.selectedPart()).toStrictEqual(part);
	});

	it('a 3D value drag previews the badge, then commits once through the editor', () => {
		const { view, updateElement } = createChartView(
			chart('bar3D'),
			{ barChart3D: true },
			{ editable: true, selected: true },
		);
		view.onChart3DValueDrag({ part, value: 42, phase: 'move' });
		expect(view.dragValue()).toBe(42);
		expect(updateElement).not.toHaveBeenCalled();
		view.onChart3DValueDrag({ part, value: 99, phase: 'commit' });
		expect(view.dragValue()).toBeNull();
		expect(updateElement).toHaveBeenCalledOnce();
		const [slideIndex, id, patch] = updateElement.mock.calls[0] as [
			number,
			string,
			{ chartData: PptxChartData },
		];
		expect(slideIndex).toBe(0);
		expect(id).toBe('ch_bar3D');
		expect(patch.chartData.series[0].values).toStrictEqual([10, 99]);
	});

	it('a read-only (unselected) mount ignores 3D select and drag', () => {
		const { view, partSelection, updateElement } = createChartView(
			chart('bar3D'),
			{ barChart3D: true },
			{ editable: true },
		);
		view.onChartPart3DSelect(part);
		view.onChart3DValueDrag({ part, value: 99, phase: 'commit' });
		expect(partSelection.selection()).toBeNull();
		expect(updateElement).not.toHaveBeenCalled();
	});
});

describe('smartArt3DRendererComponent - <pptx-three-view>', () => {
	const smartArt = {
		id: 'sa-1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			layoutType: 'list',
			nodes: [{ id: 'n1', text: 'One' }],
			drawingShapes: [
				{
					id: 'a',
					shapeType: 'roundRect',
					x: 0,
					y: 0,
					width: 400,
					height: 140,
					fillColor: '#4472C4',
					text: 'One',
				},
			],
		} as unknown as PptxSmartArtData,
	} as unknown as PptxElement;

	function createSmartArt(element: PptxElement, smartArt3D: boolean) {
		const rendering3D = new Rendering3DService();
		rendering3D.flags.set({ ...DEFAULT_RENDERING_3D_FLAGS, smartArt3D });
		const injector = Injector.create({
			providers: [...EFFECT_PROVIDERS, { provide: Rendering3DService, useValue: rendering3D }],
		});
		const component = runInInjectionContext(injector, () => new SmartArt3DRendererComponent());
		Object.assign(component, { element: signal(element) });
		return component as unknown as { spec: () => ThreeViewSpec | null; useFallback: () => boolean };
	}

	it('resolves a smartart spec when smartArt3D is on', () => {
		const component = createSmartArt(smartArt, true);
		expect(component.spec()?.kind).toBe('smartart');
		expect(component.useFallback()).toBeFalsy();
	});

	it('falls back to the SVG renderer when the diagram has nothing to draw', () => {
		const empty = {
			...smartArt,
			smartArtData: { layoutType: 'list', nodes: [] },
		} as unknown as PptxElement;
		expect(createSmartArt(empty, true).useFallback()).toBeTruthy();
	});

	it('projects the SVG renderer as the view fallback', () => {
		expect(read('smart-art-3d-renderer.component.html')).toMatch(
			/<pptx-ng-three-view \[spec\]="spec\(\)"[^>]*>\s*<pptx-smart-art-renderer/,
		);
	});
});
