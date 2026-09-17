import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	applyChartElementToggle,
	applyChartStylePreset,
	buildChartQuickActionsDescriptor,
	CHART_QUICK_ACTION_BUTTON_SIZE,
	hideChartSeries,
	restoreFilteredSeries,
} from 'pptx-viewer-shared';
import type { ChartQuickActionsDescriptor, ChartQuickElementKey } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import { createIcon } from '../ui/icons';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/**
 * PowerPoint's three floating quick-action icons ("Chart Elements" +, "Chart
 * Styles" paintbrush, "Chart Filters" funnel) shown just outside a selected
 * chart's top-right corner.
 *
 * Mirrors `connector-endpoint-overlay.ts`: a screen-space layer mounted as a
 * sibling of the rendered stage (never inside an element renderer), UNSCALED
 * so slide coordinates are multiplied by the stage scale on the way out. All
 * decision-making (which buttons render, checklist/gallery/filter state)
 * comes from the shared `buildChartQuickActionsDescriptor`; this module only
 * builds the DOM and commits through the editor's normal patch path
 * (`pushHistory` + `replaceActiveElements` + `commitChange`, the same one
 * `applyElementPatch` on the controller uses).
 *
 * @module editor/chart-quick-actions-overlay
 */

export interface ChartQuickActionsOverlayDeps {
	doc: Document;
	t: Translator;
	store: Store<ViewerState>;
	ops: EditorOps;
	/** Stage scale (screen px per slide px). */
	getScale(): number;
}

export interface ChartQuickActionsOverlay {
	root: HTMLElement;
	mount(host: HTMLElement): void;
	/** Re-render from the current state. */
	sync(): void;
	dispose(): void;
}

/** The single selected chart, or null (mirrors connector-endpoint-overlay's `selectedConnector`). */
function selectedChart(state: ViewerState): ChartPptxElement | null {
	if (!state.editable || state.presenting || state.selectedElementIds.length !== 1) {
		return null;
	}
	const element = getActiveElements(state).find((el) => el.id === state.selectedElementId);
	return element && element.type === 'chart' ? element : null;
}

export function createChartQuickActionsOverlay(
	deps: ChartQuickActionsOverlayDeps,
): ChartQuickActionsOverlay {
	const { doc, t, store, ops } = deps;
	const root = doc.createElement('div');
	root.className = 'pptxv-chart-quick-actions';
	root.setAttribute('data-pptx-chart-quick-actions', '');

	let open: 'elements' | 'styles' | 'filters' | null = null;

	function commit(chartId: string, chartData: NonNullable<ChartPptxElement['chartData']>): void {
		const state = store.get();
		if (!state.editable || !getActiveElements(state).some((el) => el.id === chartId)) {
			return;
		}
		ops.pushHistory();
		store.set(
			replaceActiveElements(
				state,
				getActiveElements(state).map((el) =>
					el.id === chartId ? ({ ...el, chartData } as PptxElement) : el,
				),
			),
		);
		ops.commitChange();
	}

	function stopEvent(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
	}

	function toggle(id: 'elements' | 'styles' | 'filters'): void {
		open = open === id ? null : id;
		render();
	}

	function buildButton(
		button: ChartQuickActionsDescriptor['buttons'][number],
		canEdit: boolean,
	): HTMLButtonElement {
		const btn = doc.createElement('button');
		btn.type = 'button';
		btn.className = 'pptxv-chart-quick-btn';
		btn.disabled = !canEdit;
		btn.dataset.testid = `chart-quick-action-${button.id}`;
		btn.setAttribute('aria-label', t(button.labelKey));
		btn.title = t(button.labelKey);
		// `button.x/y/size` are already SCREEN px: the descriptor was built
		// against a selectionBox pre-multiplied by the stage scale (see
		// `render` below), matching this layer's unscaled coordinate space.
		btn.style.left = `${button.x}px`;
		btn.style.top = `${button.y}px`;
		btn.style.width = `${button.size}px`;
		btn.style.height = `${button.size}px`;
		btn.appendChild(
			createIcon(
				doc,
				button.id === 'elements' ? 'plus' : button.id === 'styles' ? 'paintbrush' : 'filter',
			),
		);
		btn.addEventListener('pointerdown', stopEvent);
		btn.addEventListener('click', () => toggle(button.id));
		return btn;
	}

	function buildElementsPopover(
		descriptor: ChartQuickActionsDescriptor,
		chart: ChartPptxElement,
		canEdit: boolean,
		x: number,
		y: number,
	): HTMLElement {
		const card = doc.createElement('div');
		card.className = 'pptxv-chart-quick-card';
		card.dataset.testid = 'chart-quick-elements-popover';
		card.style.left = `${x}px`;
		card.style.top = `${y}px`;
		const heading = doc.createElement('h5');
		heading.textContent = t('pptx.chart.quickElements');
		card.appendChild(heading);
		for (const item of descriptor.elements) {
			const label = doc.createElement('label');
			label.className = 'row';
			const checkbox = doc.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.disabled = !canEdit;
			checkbox.checked = item.checked;
			checkbox.dataset.testid = `chart-quick-element-${item.key}`;
			checkbox.addEventListener('pointerdown', stopEvent);
			checkbox.addEventListener('change', () => {
				const chartData = chart.chartData;
				if (!chartData) {
					return;
				}
				commit(
					chart.id,
					applyChartElementToggle(chartData, item.key as ChartQuickElementKey, checkbox.checked),
				);
				render();
			});
			const span = doc.createElement('span');
			span.textContent = t(item.labelKey);
			label.append(checkbox, span);
			card.appendChild(label);
		}
		return card;
	}

	function buildStylesPopover(
		descriptor: ChartQuickActionsDescriptor,
		chart: ChartPptxElement,
		canEdit: boolean,
		x: number,
		y: number,
	): HTMLElement {
		const card = doc.createElement('div');
		card.className = 'pptxv-chart-quick-card pptxv-chart-quick-styles';
		card.dataset.testid = 'chart-quick-styles-popover';
		card.style.left = `${x}px`;
		card.style.top = `${y}px`;
		for (const preset of descriptor.styles.presets) {
			const button = doc.createElement('button');
			button.type = 'button';
			button.className = 'pptxv-chart-quick-swatch';
			button.classList.toggle('is-applied', preset.applied);
			button.disabled = !canEdit;
			button.dataset.testid = `chart-quick-style-${preset.id}`;
			button.setAttribute('aria-label', t(preset.labelKey));
			button.setAttribute('aria-pressed', String(preset.applied));
			button.title = t(preset.labelKey);
			const row = doc.createElement('span');
			row.className = 'swatch-row';
			for (const c of preset.colors.slice(0, 5)) {
				const swatch = doc.createElement('span');
				swatch.style.backgroundColor = c;
				row.appendChild(swatch);
			}
			button.appendChild(row);
			button.addEventListener('pointerdown', stopEvent);
			button.addEventListener('click', () => {
				const chartData = chart.chartData;
				if (!chartData) {
					return;
				}
				const next = applyChartStylePreset(chartData, preset.id);
				if (next) {
					commit(chart.id, next);
				}
				render();
			});
			card.appendChild(button);
		}
		return card;
	}

	function buildFiltersPopover(
		descriptor: ChartQuickActionsDescriptor,
		chart: ChartPptxElement,
		canEdit: boolean,
		x: number,
		y: number,
	): HTMLElement {
		const card = doc.createElement('div');
		card.className = 'pptxv-chart-quick-card';
		card.dataset.testid = 'chart-quick-filters-popover';
		card.style.left = `${x}px`;
		card.style.top = `${y}px`;
		const heading = doc.createElement('h5');
		heading.textContent = t('pptx.chart.quickFilters');
		card.appendChild(heading);
		for (const row of descriptor.filters.series) {
			const label = doc.createElement('label');
			label.className = 'row';
			const checkbox = doc.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.disabled = !canEdit;
			checkbox.checked = row.visible;
			checkbox.dataset.testid = `chart-quick-filter-${row.key}`;
			checkbox.addEventListener('pointerdown', stopEvent);
			checkbox.addEventListener('change', () => {
				const chartData = chart.chartData;
				if (!chartData) {
					return;
				}
				const next =
					row.seriesIndex !== undefined
						? hideChartSeries(chartData, row.seriesIndex)
						: restoreFilteredSeries(chartData, row.filteredIndex!);
				if (next) {
					commit(chart.id, next);
				}
				render();
			});
			const name = doc.createElement('span');
			name.className = 'name';
			name.textContent = row.name;
			label.append(checkbox, name);
			card.appendChild(label);
		}
		return card;
	}

	function render(): void {
		const state = store.get();
		const chart = selectedChart(state);
		root.replaceChildren();
		if (!chart || !chart.chartData) {
			return;
		}
		const scale = deps.getScale() || 1;
		const descriptor = buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: chart.chartData,
			selectionBox: {
				x: chart.x * scale,
				y: chart.y * scale,
				width: chart.width * scale,
				height: chart.height * scale,
			},
		});
		if (!descriptor) {
			return;
		}
		if (open && !descriptor.buttons.some((b) => b.id === open)) {
			open = null;
		}
		for (const button of descriptor.buttons) {
			root.appendChild(buildButton(button, state.editable));
			if (open !== button.id) {
				continue;
			}
			const popoverX = button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4;
			const popoverY = button.y;
			if (button.id === 'elements') {
				root.appendChild(
					buildElementsPopover(descriptor, chart, state.editable, popoverX, popoverY),
				);
			} else if (button.id === 'styles') {
				root.appendChild(buildStylesPopover(descriptor, chart, state.editable, popoverX, popoverY));
			} else {
				root.appendChild(
					buildFiltersPopover(descriptor, chart, state.editable, popoverX, popoverY),
				);
			}
		}
	}

	return {
		root,
		mount(host) {
			host.appendChild(root);
			render();
		},
		sync: render,
		dispose() {
			open = null;
			root.remove();
		},
	};
}
