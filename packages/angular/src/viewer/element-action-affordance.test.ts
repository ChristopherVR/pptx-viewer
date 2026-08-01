// @vitest-environment jsdom
/**
 * On-canvas action affordances, Angular side.
 *
 * `ElementRendererComponent` dispatches every non-shape type straight to a
 * per-type component whose root IS the element node, so there is no wrapper in
 * the template to hang the badge / tooltip off. They are painted instead by the
 * shared post-render stage pass that `SlideCanvasComponent` already runs for
 * the role / name half of the element contract. This package has no TestBed
 * (component rendering needs `@analogjs/vite-plugin-angular`), so the pass is
 * exercised against a stage shaped exactly like the component's template
 * output, plus the pure gate the component feeds it.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	ACTION_INDICATOR_CLASS,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
	actionAffordanceLabels,
	applyElementActionAffordances,
	isTemplateElement,
} from '../internal/shared';
import { affordanceElements } from './slide-canvas-helpers';

const labels = actionAffordanceLabels((key) => key);
const base = { x: 0, y: 0, width: 100, height: 40 };

/** A stage carrying the same `data-element-id` roots the component renders. */
function stageWith(...ids: string[]): HTMLElement {
	const stage = document.createElement('div');
	for (const id of ids) {
		const node = document.createElement('div');
		node.className = 'pptx-ng-element';
		node.setAttribute('data-element-id', id);
		node.setAttribute('data-pptx-element', 'true');
		stage.appendChild(node);
	}
	return stage;
}

describe('angular slide-canvas action affordances', () => {
	it('badges an action shape and offers its destination tooltip', () => {
		const stage = stageWith('sp-1');
		applyElementActionAffordances(
			stage,
			[
				{ ...base, id: 'sp-1', type: 'shape', actionClick: { url: 'https://example.test' } },
			] as PptxElement[],
			{ canInteract: true, labels },
		);
		const node = stage.querySelector('[data-element-id="sp-1"]');
		expect(node?.querySelector(`.${ACTION_INDICATOR_CLASS}`)).not.toBeNull();
		expect(node?.querySelector(`.${LINK_TOOLTIP_CLASS}`)?.textContent).toContain(
			'https://example.test',
		);
		expect(node?.classList.contains(LINK_TOOLTIP_HOST_CLASS)).toBeTruthy();
	});

	it('badges any element type, including the ones with a delegated renderer', () => {
		const stage = stageWith('pic-1', 'chart-1');
		applyElementActionAffordances(
			stage,
			[
				{ ...base, id: 'pic-1', type: 'picture', actionClick: { url: 'https://a.test' } },
				{ ...base, id: 'chart-1', type: 'chart', actionClick: { url: 'https://b.test' } },
			] as PptxElement[],
			{ canInteract: true, labels },
		);
		expect(stage.querySelectorAll(`.${ACTION_INDICATOR_CLASS}`)).toHaveLength(2);
	});

	it('draws nothing while a show is running', () => {
		const stage = stageWith('sp-1');
		applyElementActionAffordances(
			stage,
			[
				{ ...base, id: 'sp-1', type: 'shape', actionClick: { url: 'https://a.test' } },
			] as PptxElement[],
			{ canInteract: true, presenting: true, labels },
		);
		expect(stage.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});
});

describe('affordanceElements', () => {
	const slideShape = { ...base, id: 'sp-1', type: 'shape' } as PptxElement;
	const templateShape = {
		...base,
		id: 'layout-ppt/slideLayouts/slideLayout1.xml-shape-2',
		type: 'shape',
	} as PptxElement;

	it('leaves an inert template shape undecorated', () => {
		expect(affordanceElements([slideShape, templateShape], false, isTemplateElement)).toStrictEqual(
			[slideShape],
		);
	});

	it('decorates it once edit-template mode makes it reachable', () => {
		expect(affordanceElements([slideShape, templateShape], true, isTemplateElement)).toHaveLength(
			2,
		);
	});
});
