import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	ACTION_AFFORDANCE_CSS,
	ACTION_INDICATOR_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
	resolveElementActionAffordance,
} from './element-action-affordance';
import type { ActionAffordanceLabels } from './element-action-affordance';

const labels: ActionAffordanceLabels = {
	hasAction: 'Has action',
	link: 'Link',
	followLink: 'Ctrl+Click to follow link',
	presentationMode: 'Active in presentation mode',
};

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('resolveElementActionAffordance', () => {
	it('draws nothing for an element with no action', () => {
		const affordance = resolveElementActionAffordance(shape(), { canInteract: true, labels });
		expect(affordance.showIndicator).toBeFalsy();
		expect(affordance.showLinkTooltip).toBeFalsy();
	});

	it('draws both affordances for a click action on the editing canvas', () => {
		const affordance = resolveElementActionAffordance(
			shape({ actionClick: { url: 'https://example.test' } }),
			{ canInteract: true, labels },
		);
		expect(affordance.showIndicator).toBeTruthy();
		expect(affordance.showLinkTooltip).toBeTruthy();
		expect(affordance.linkTooltipLabel).toBe('https://example.test');
		expect(affordance.linkTooltipHint).toBe('Ctrl+Click to follow link');
		expect(affordance.indicatorTitle).toBe('Has action');
	});

	it('prefers the deck screen tip over the URL', () => {
		const affordance = resolveElementActionAffordance(
			shape({ actionClick: { url: 'https://example.test', tooltip: 'Open the wheel' } }),
			{ canInteract: true, labels },
		);
		expect(affordance.indicatorTitle).toBe('Open the wheel');
		expect(affordance.linkTooltipLabel).toBe('Open the wheel');
	});

	it('names a navigation verb and its hint when there is no URL', () => {
		const affordance = resolveElementActionAffordance(
			shape({ actionClick: { action: 'ppaction://hlinkshowjump?jump=nextslide' } }),
			{ canInteract: true, labels },
		);
		expect(affordance.linkTooltipLabel).toBe('ppaction://hlinkshowjump?jump=nextslide');
		expect(affordance.linkTooltipHint).toBe('Active in presentation mode');
	});

	it('falls back to the generic link label when the action names nothing', () => {
		const affordance = resolveElementActionAffordance(shape({ actionClick: {} }), {
			canInteract: true,
			labels,
		});
		expect(affordance.linkTooltipLabel).toBe('Link');
	});

	it('badges a hover-only action but shows no tooltip: there is nothing to follow', () => {
		const affordance = resolveElementActionAffordance(
			shape({ actionHover: { tooltip: 'Play a sound' } }),
			{ canInteract: true, labels },
		);
		expect(affordance.showIndicator).toBeTruthy();
		expect(affordance.indicatorTitle).toBe('Play a sound');
		expect(affordance.showLinkTooltip).toBeFalsy();
	});

	it('draws nothing off the editing canvas (thumbnails, previews, export)', () => {
		const affordance = resolveElementActionAffordance(
			shape({ actionClick: { url: 'https://example.test' } }),
			{ canInteract: false, labels },
		);
		expect(affordance.showIndicator).toBeFalsy();
		expect(affordance.showLinkTooltip).toBeFalsy();
	});

	it('draws nothing during a running show, even on an interactive stage', () => {
		const affordance = resolveElementActionAffordance(
			shape({ actionClick: { url: 'https://example.test' } }),
			{ canInteract: true, presenting: true, labels },
		);
		expect(affordance.showIndicator).toBeFalsy();
		expect(affordance.showLinkTooltip).toBeFalsy();
	});
});

describe('action affordance css', () => {
	it('pins the tooltip typography instead of inheriting the host app font', () => {
		expect(ACTION_AFFORDANCE_CSS).toContain('font-family: system-ui, -apple-system,');
	});

	it('reveals the tooltip only while its host element is hovered', () => {
		expect(ACTION_AFFORDANCE_CSS).toContain(`.${LINK_TOOLTIP_HOST_CLASS}:hover`);
	});

	it('themes the badge from the shared amber', () => {
		expect(ACTION_AFFORDANCE_CSS).toContain(`.${ACTION_INDICATOR_CLASS} {`);
		expect(ACTION_AFFORDANCE_CSS).toContain('#f59e0b');
	});
});
