// @vitest-environment jsdom

import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	ACTION_INDICATOR_CLASS,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
} from './element-action-affordance';
import type { ActionAffordanceLabels } from './element-action-affordance';
import { applyElementActionAffordances } from './element-action-affordance-dom';

const labels: ActionAffordanceLabels = {
	hasAction: 'Has action',
	link: 'Link',
	followLink: 'Ctrl+Click to follow link',
	presentationMode: 'Active in presentation mode',
};

const base = { x: 0, y: 0, width: 100, height: 50 };

function stageWith(...ids: string[]): HTMLElement {
	const stage = document.createElement('div');
	stage.innerHTML = ids.map((id) => `<div data-element-id="${id}"></div>`).join('');
	return stage;
}

function node(stage: HTMLElement, id: string): HTMLElement {
	return stage.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
}

describe('applyElementActionAffordances', () => {
	it('paints the badge and the tooltip on an action shape', () => {
		const stage = stageWith('sp1');
		const elements = [
			{ ...base, id: 'sp1', type: 'shape', actionClick: { url: 'https://example.test' } },
		] as PptxElement[];

		expect(applyElementActionAffordances(stage, elements, { canInteract: true, labels })).toBe(1);
		const el = node(stage, 'sp1');
		expect(el.querySelector(`.${ACTION_INDICATOR_CLASS}`)).not.toBeNull();
		expect(el.querySelector(`.${LINK_TOOLTIP_CLASS}`)?.textContent).toContain(
			'https://example.test',
		);
		expect(el.classList.contains(LINK_TOOLTIP_HOST_CLASS)).toBeTruthy();
		expect(el.querySelector(`.${ACTION_INDICATOR_CLASS}`)?.getAttribute('title')).toBe(
			'Has action',
		);
	});

	it('is idempotent: a re-run neither duplicates nor rebuilds the nodes', () => {
		const stage = stageWith('sp1');
		const elements = [
			{ ...base, id: 'sp1', type: 'shape', actionClick: { url: 'https://example.test' } },
		] as PptxElement[];
		applyElementActionAffordances(stage, elements, { canInteract: true, labels });
		const first = node(stage, 'sp1').querySelector(`.${ACTION_INDICATOR_CLASS}`);
		applyElementActionAffordances(stage, elements, { canInteract: true, labels });
		const el = node(stage, 'sp1');
		expect(el.querySelectorAll(`.${ACTION_INDICATOR_CLASS}`)).toHaveLength(1);
		expect(el.querySelectorAll(`.${LINK_TOOLTIP_CLASS}`)).toHaveLength(1);
		expect(el.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBe(first);
	});

	it('refreshes the tooltip text when the action changes', () => {
		const stage = stageWith('sp1');
		applyElementActionAffordances(
			stage,
			[
				{ ...base, id: 'sp1', type: 'shape', actionClick: { url: 'https://a.test' } },
			] as PptxElement[],
			{ canInteract: true, labels },
		);
		applyElementActionAffordances(
			stage,
			[
				{
					...base,
					id: 'sp1',
					type: 'shape',
					actionClick: { action: 'ppaction://hlinkshowjump?jump=nextslide' },
				},
			] as PptxElement[],
			{ canInteract: true, labels },
		);
		const tooltip = node(stage, 'sp1').querySelector(`.${LINK_TOOLTIP_CLASS}`);
		expect(tooltip?.textContent).toContain('ppaction://hlinkshowjump?jump=nextslide');
		expect(tooltip?.textContent).toContain('Active in presentation mode');
	});

	it('removes the affordances once the action is gone', () => {
		const stage = stageWith('sp1');
		applyElementActionAffordances(
			stage,
			[
				{ ...base, id: 'sp1', type: 'shape', actionClick: { url: 'https://a.test' } },
			] as PptxElement[],
			{ canInteract: true, labels },
		);
		applyElementActionAffordances(stage, [{ ...base, id: 'sp1', type: 'shape' }] as PptxElement[], {
			canInteract: true,
			labels,
		});
		const el = node(stage, 'sp1');
		expect(el.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
		expect(el.classList.contains(LINK_TOOLTIP_HOST_CLASS)).toBeFalsy();
	});

	it('paints nothing while a show is running', () => {
		const stage = stageWith('sp1');
		const elements = [
			{ ...base, id: 'sp1', type: 'shape', actionClick: { url: 'https://a.test' } },
		] as PptxElement[];
		expect(
			applyElementActionAffordances(stage, elements, {
				canInteract: true,
				presenting: true,
				labels,
			}),
		).toBe(0);
		expect(node(stage, 'sp1').querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});

	it('leaves a connector alone: its box is a pointer-transparent bounding box', () => {
		const stage = stageWith('cx1');
		const elements = [
			{ ...base, id: 'cx1', type: 'connector', actionClick: { url: 'https://a.test' } },
		] as PptxElement[];
		expect(applyElementActionAffordances(stage, elements, { canInteract: true, labels })).toBe(0);
		expect(node(stage, 'cx1').querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});

	it('badges only the group, never its children', () => {
		const stage = document.createElement('div');
		stage.innerHTML = '<div data-element-id="grp"><div data-element-id="kid"></div></div>';
		const elements = [
			{
				...base,
				id: 'grp',
				type: 'group',
				actionClick: { url: 'https://a.test' },
				children: [{ ...base, id: 'kid', type: 'shape', actionClick: { url: 'https://b.test' } }],
			},
		] as unknown as PptxElement[];
		applyElementActionAffordances(stage, elements, { canInteract: true, labels });
		expect(node(stage, 'grp').querySelectorAll(`:scope > .${ACTION_INDICATOR_CLASS}`)).toHaveLength(
			1,
		);
		expect(node(stage, 'kid').querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});
});
