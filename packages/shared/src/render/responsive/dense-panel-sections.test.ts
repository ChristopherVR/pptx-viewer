import { describe, expect, it } from 'vitest';

import { getSectionLayoutPlan } from './dense-panel-sections';

describe('getSectionLayoutPlan', () => {
	it('lays out side by side on desktop regardless of section count', () => {
		expect(getSectionLayoutPlan(1280, 6)).toStrictEqual({
			mode: 'side-by-side',
			stacked: false,
			collapsible: false,
		});
	});

	it('stacks at 360px but does not add an accordion for few sections', () => {
		expect(getSectionLayoutPlan(360, 2)).toStrictEqual({
			mode: 'stacked-accordion',
			stacked: true,
			collapsible: false,
		});
	});

	it('stacks and collapses into an accordion at 360px once there are 3+ sections', () => {
		expect(getSectionLayoutPlan(360, 3)).toStrictEqual({
			mode: 'stacked-accordion',
			stacked: true,
			collapsible: true,
		});
		expect(getSectionLayoutPlan(360, 8)).toStrictEqual({
			mode: 'stacked-accordion',
			stacked: true,
			collapsible: true,
		});
	});
});
