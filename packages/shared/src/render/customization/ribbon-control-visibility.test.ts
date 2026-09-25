import { describe, expect, it } from 'vitest';

import { createCustomizationController } from './customization-controller';
import { resolveCustomization } from './customization-resolve';
import { RIBBON_CONTROL_IDS, RIBBON_GROUP_IDS, RIBBON_GROUPS } from './ribbon-control-ids';
import {
	isRibbonControlVisible,
	isRibbonGroupVisible,
	RIBBON_SCOPE_ATTR,
	ribbonCustomizationCss,
} from './ribbon-control-visibility';

describe('ribbon control catalogue', () => {
	it('gives every group and control a unique, well-formed id', () => {
		expect(new Set(RIBBON_GROUP_IDS).size).toBe(RIBBON_GROUP_IDS.length);
		expect(new Set(RIBBON_CONTROL_IDS).size).toBe(RIBBON_CONTROL_IDS.length);
		for (const id of RIBBON_GROUP_IDS) {
			expect(id).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/u);
		}
		for (const id of RIBBON_CONTROL_IDS) {
			expect(id).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+$/u);
		}
		for (const group of RIBBON_GROUPS) {
			expect(group.controls.length).toBeGreaterThan(0);
			expect(group.label.length).toBeGreaterThan(0);
		}
	});
});

describe('ribbon group / control customisation', () => {
	it('splits hiddenButtons into toolbar actions and catalogued controls', () => {
		const resolved = resolveCustomization({
			ribbon: {
				hiddenTabs: ['draw', 'chartDesign'],
				hiddenGroups: ['home.font'],
				hiddenButtons: ['share', 'home.paragraph.bullets', 'mergeShapes'],
			},
		});
		expect(resolved.hiddenActions.has('share')).toBeTruthy();
		expect(resolved.hiddenActions.has('draw')).toBeTruthy();
		expect(resolved.hiddenContextualTabs.has('chartDesign')).toBeTruthy();
		expect(resolved.hiddenActions.has('chartDesign' as never)).toBeFalsy();
		expect(resolved.hiddenRibbonGroups.has('home.font')).toBeTruthy();
		expect(resolved.hiddenRibbonControls.has('home.paragraph.bullets')).toBeTruthy();
		// The legacy button id and its catalogued control hide together.
		expect(resolved.hiddenRibbonControls.has('home.arrange.mergeShapes')).toBeTruthy();
		expect(isRibbonGroupVisible(resolved, 'home.font')).toBeFalsy();
		expect(isRibbonControlVisible(resolved, 'home.font.bold')).toBeFalsy();
		expect(isRibbonControlVisible(resolved, 'home.paragraph.bullets')).toBeFalsy();
		expect(isRibbonControlVisible(resolved, 'home.paragraph.numbering')).toBeTruthy();
	});

	it('hides a catalogued control through its legacy toolbar id too', () => {
		const resolved = resolveCustomization({ ribbon: { hiddenButtons: ['home.arrange.crop'] } });
		expect(resolved.hiddenActions.has('crop')).toBeTruthy();
	});

	it('builds one scoped stylesheet, and nothing when nothing is hidden', () => {
		expect(ribbonCustomizationCss(resolveCustomization(undefined), 'v1')).toBe('');
		const css = ribbonCustomizationCss(
			resolveCustomization({
				ribbon: { hiddenGroups: ['insert.media'], hiddenButtons: ['view.show.ruler'] },
			}),
			'v1',
		);
		expect(css).toContain(`[${RIBBON_SCOPE_ATTR}="v1"] [data-ribbon-group="insert.media"]`);
		expect(css).toContain(`[${RIBBON_SCOPE_ATTR}="v1"] [data-ribbon-control="view.show.ruler"]`);
		expect(css).toContain('display: none !important');
	});

	it('ignores ids and scopes that are not catalogued or not safe', () => {
		const resolved = resolveCustomization({
			ribbon: { hiddenGroups: ['home.font"]{} body{' as never] },
		});
		expect(ribbonCustomizationCss(resolved)).toBe('');
		const css = ribbonCustomizationCss(
			resolveCustomization({ ribbon: { hiddenGroups: ['home.font'] } }),
			'bad"scope',
		);
		expect(css.startsWith('[data-ribbon-group="home.font"]')).toBeTruthy();
	});

	it('exposes group and control helpers on the controller', () => {
		const controller = createCustomizationController();
		controller.api.hideRibbonGroup('home.editing');
		controller.api.hideRibbonControl('home.font.italic');
		controller.api.hideToolbarButton('home.font.bold');
		controller.api.hideRibbonTab('pictureFormat');
		const resolved = controller.getResolved();
		expect(resolved.hiddenRibbonGroups.has('home.editing')).toBeTruthy();
		expect(resolved.hiddenRibbonControls.has('home.font.italic')).toBeTruthy();
		expect(resolved.hiddenRibbonControls.has('home.font.bold')).toBeTruthy();
		expect(resolved.hiddenContextualTabs.has('pictureFormat')).toBeTruthy();
		controller.api.showRibbonGroup('home.editing');
		controller.api.showRibbonControl('home.font.italic');
		expect(controller.getResolved().hiddenRibbonGroups.size).toBe(0);
		expect(controller.api.getCustomization().ribbon?.hiddenButtons).toStrictEqual([
			'home.font.bold',
		]);
	});
});
