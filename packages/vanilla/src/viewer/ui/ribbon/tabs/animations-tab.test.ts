import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createAnimationsTab } from './animations-tab';

function handlers() {
	return {
		addAnimation: vi.fn(),
		removeAnimation: vi.fn(),
		reorderAnimation: vi.fn(),
		setAnimationTiming: vi.fn(),
		moveAnimation: vi.fn(),
	};
}

function control(tab: { el: HTMLElement }, label: string): HTMLElement {
	const match = [...tab.el.querySelectorAll<HTMLElement>('button, input, select')].find(
		(node) => node.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing animations control: ${label}`);
	}
	return match;
}

const selected = { editable: true, hasSelection: true, animations: [] };

describe('createAnimationsTab', () => {
	it('offers Preview and the whole shared preset catalogue, each preset once', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		expect(control(tab, t('pptx.animations.preview'))).toBeTruthy();

		const presets = [...ENTRANCE_PRESET_VALUES, ...EMPHASIS_PRESET_VALUES, ...EXIT_PRESET_VALUES];
		const buttons = [
			...tab.el.querySelectorAll<HTMLButtonElement>('.pptxv-animation-gallery button'),
		];
		expect(buttons).toHaveLength(presets.length);
		const names = buttons.map((button) => button.getAttribute('aria-label'));
		for (const preset of presets) {
			const label = t(`pptx.animation.preset.${preset}`);
			expect(names.filter((name) => name === label)).toHaveLength(1);
		}
	});

	it('captions the three buckets without turning them into commands', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		const captions = [...tab.el.querySelectorAll('.pptxv-animation-gallery-caption')].map(
			(node) => node.textContent,
		);
		expect(captions).toStrictEqual([
			t('pptx.animation.entrance'),
			t('pptx.animation.emphasis'),
			t('pptx.animation.exit'),
		]);
		// A caption rendered as a permanently disabled button is a command the
		// user can never run, and the ribbon inventory reads it as one.
		for (const caption of captions) {
			expect(
				[...tab.el.querySelectorAll('button')].some((button) => button.textContent === caption),
			).toBeFalsy();
		}
	});

	it('adds the preset its gallery button names', () => {
		const t = createTranslator();
		const actions = handlers();
		const tab = createAnimationsTab(document, t, actions, vi.fn());
		tab.update(selected);
		(control(tab, t('pptx.animation.preset.growTurnIn')) as HTMLButtonElement).click();
		(control(tab, t('pptx.animation.preset.teeter')) as HTMLButtonElement).click();
		expect(actions.addAnimation).toHaveBeenNthCalledWith(1, 'entrance', 'growTurnIn');
		expect(actions.addAnimation).toHaveBeenNthCalledWith(2, 'emphasis', 'teeter');
	});

	it('offers the Advanced Animation and Timing controls', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		for (const label of [
			t('pptx.animations.exitEffects'),
			t('pptx.animations.pathAnimation'),
			t('pptx.animations.effectOptions'),
			t('pptx.animations.animationPanel'),
			t('pptx.animations.trigger'),
			t('pptx.animations.painter'),
			t('pptx.animations.remove'),
			t('pptx.animations.duration'),
		]) {
			expect(control(tab, label)).toBeTruthy();
		}
		// The Start select is named by its associated <label>, not an aria-label.
		expect(tab.el.querySelector('label[for^="pptx-animation-start"]')?.textContent).toBe(
			t('pptx.animations.start'),
		);
	});

	it('applies the presets its Exit Effects and Path Animation shortcuts name', () => {
		const t = createTranslator();
		const actions = handlers();
		const tab = createAnimationsTab(document, t, actions, vi.fn());
		tab.update(selected);
		(control(tab, t('pptx.animations.exitEffects')) as HTMLButtonElement).click();
		(control(tab, t('pptx.animations.pathAnimation')) as HTMLButtonElement).click();
		expect(actions.addAnimation).toHaveBeenNthCalledWith(1, 'exit', 'fadeOut');
		expect(actions.addAnimation).toHaveBeenNthCalledWith(2, 'entrance', 'flyIn');
	});

	it('opens the animation panel from Effect Options, Animation Panel and Trigger', () => {
		const t = createTranslator();
		const onOpenAnimationPanel = vi.fn();
		const tab = createAnimationsTab(document, t, handlers(), onOpenAnimationPanel);
		tab.update(selected);
		for (const label of [
			t('pptx.animations.effectOptions'),
			t('pptx.animations.animationPanel'),
			t('pptx.animations.trigger'),
		]) {
			(control(tab, label) as HTMLButtonElement).click();
		}
		expect(onOpenAnimationPanel).toHaveBeenCalledTimes(3);
	});

	it('leaves the unimplemented placeholders disabled even with a selection', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		tab.update(selected);
		expect((control(tab, t('pptx.animations.painter')) as HTMLButtonElement).disabled).toBeTruthy();
		expect((control(tab, t('pptx.animations.duration')) as HTMLInputElement).disabled).toBeTruthy();
	});

	it('needs a selected element before an effect can be applied', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		tab.update({ editable: true, hasSelection: false, animations: [] });
		const first = tab.el.querySelector<HTMLButtonElement>('.pptxv-animation-gallery button');
		expect(first?.disabled).toBeTruthy();
		expect((control(tab, t('pptx.animations.remove')) as HTMLButtonElement).disabled).toBeTruthy();
	});
});
