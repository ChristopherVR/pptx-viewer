import {
	DEFAULT_MOTION_PATH_PRESET_ID,
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
	MOTION_PATH_PRESETS,
} from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createAnimationsTab } from './animations-tab';

function handlers() {
	return {
		addAnimation: vi.fn(),
		applyMotionPath: vi.fn(),
		removeAnimation: vi.fn(),
		reorderAnimation: vi.fn(),
		setAnimationTiming: vi.fn(),
		moveAnimation: vi.fn(),
	};
}

/** A timeline control (light DOM), found by its explicit accessible name. */
function control(tab: { el: HTMLElement }, label: string): HTMLElement {
	const match = [
		...tab.el.querySelectorAll<HTMLElement>('button, input, select, pptx-ui-select'),
	].find((node) => node.getAttribute('aria-label') === label);
	if (!match) {
		throw new Error(`missing animations control: ${label}`);
	}
	return match;
}

/** A shared ribbon command: a host with a customization id and a shadow-root button. */
function command(tab: { el: HTMLElement }, id: string): HTMLButtonElement {
	return tab.el
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}

function presetButtons(tab: { el: HTMLElement }, gallery: string): HTMLButtonElement[] {
	return [
		...tab.el.querySelectorAll<HTMLButtonElement>(`[data-ribbon-control="${gallery}"] button`),
	];
}

function preset(tab: { el: HTMLElement }, id: string): HTMLButtonElement {
	return tab.el.querySelector<HTMLButtonElement>(`[data-animation-preset="${id}"]`)!;
}

const selected = { editable: true, hasSelection: true, animations: [] };

describe('createAnimationsTab', () => {
	it('offers Preview and the whole shared preset catalogue, each preset once', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		expect(command(tab, 'animations.preview.preview')).toBeTruthy();

		const presets = [...ENTRANCE_PRESET_VALUES, ...EMPHASIS_PRESET_VALUES, ...EXIT_PRESET_VALUES];
		const buttons = presetButtons(tab, 'animations.animation.gallery');
		expect(buttons).toHaveLength(presets.length);
		const names = buttons.map((button) => button.title);
		for (const value of presets) {
			const label = t(`pptx.animation.preset.${value}`);
			expect(names.filter((name) => name === label)).toHaveLength(1);
		}
	});

	it('captions the three buckets without turning them into commands', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		const captions = [
			...tab.el.querySelectorAll('[data-ribbon-control="animations.animation.gallery"] .caption'),
		].map((node) => node.textContent);
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
		const actions = handlers();
		const tab = createAnimationsTab(document, createTranslator(), actions, vi.fn());
		tab.update(selected);
		preset(tab, 'growTurnIn').click();
		preset(tab, 'teeter').click();
		expect(actions.addAnimation).toHaveBeenNthCalledWith(1, 'entrance', 'growTurnIn');
		expect(actions.addAnimation).toHaveBeenNthCalledWith(2, 'emphasis', 'teeter');
	});

	it('offers the Advanced Animation and Timing controls', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		for (const id of [
			'animations.advancedAnimation.addAnimation',
			'animations.animation.effectOptions',
			'animations.advancedAnimation.animationPane',
			'animations.advancedAnimation.trigger',
			'animations.advancedAnimation.animationPainter',
			'animations.advancedAnimation.remove',
		]) {
			expect(command(tab, id)).toBeTruthy();
		}
		const duration = tab.el.querySelector('[data-ribbon-control="animations.timing.duration"]');
		expect(duration?.getAttribute('aria-label')).toBe(t('pptx.animations.duration'));
		// The Start select is named by its associated <label>, not an aria-label.
		expect(tab.el.querySelector('label[for^="pptx-animations-start"]')?.textContent).toBe(
			t('pptx.animations.start'),
		);
	});

	it('applies the presets its Exit Effects and Path Animation shortcuts name', () => {
		const actions = handlers();
		const tab = createAnimationsTab(document, createTranslator(), actions, vi.fn());
		tab.update(selected);
		command(tab, 'animations.advancedAnimation.addAnimation').click();
		tab.el
			.querySelectorAll('pptx-ui-ribbon-command')[2]
			.shadowRoot!.querySelector('button')!
			.click();
		expect(actions.addAnimation).toHaveBeenNthCalledWith(1, 'exit', 'fadeOut');
		// Path Animation must apply a PATH; it used to apply a Fly In entrance.
		expect(actions.applyMotionPath).toHaveBeenCalledWith(DEFAULT_MOTION_PATH_PRESET_ID);
		expect(actions.addAnimation).toHaveBeenCalledOnce();
	});

	it('opens the animation panel from Effect Options, Animation Panel and Trigger', () => {
		const onOpenAnimationPanel = vi.fn();
		const tab = createAnimationsTab(document, createTranslator(), handlers(), onOpenAnimationPanel);
		tab.update(selected);
		for (const id of [
			'animations.animation.effectOptions',
			'animations.advancedAnimation.animationPane',
			'animations.advancedAnimation.trigger',
		]) {
			command(tab, id).click();
		}
		expect(onOpenAnimationPanel).toHaveBeenCalledTimes(3);
	});

	it('reflects the inspector as the pressed Animation Pane and routes Remove', () => {
		const actions = handlers();
		const tab = createAnimationsTab(document, createTranslator(), actions, vi.fn());
		tab.update({ ...selected, paneOpen: true });
		const pane = command(tab, 'animations.advancedAnimation.animationPane');
		expect(pane.getAttribute('aria-pressed')).toBe('true');
		command(tab, 'animations.advancedAnimation.remove').click();
		expect(actions.removeAnimation).toHaveBeenCalledOnce();
		tab.update({ ...selected, paneOpen: false });
		expect(pane.getAttribute('aria-pressed')).toBe('false');
	});

	it('leaves the unimplemented placeholders disabled even with a selection', () => {
		const tab = createAnimationsTab(document, createTranslator(), handlers(), vi.fn());
		tab.update(selected);
		expect(command(tab, 'animations.advancedAnimation.animationPainter').disabled).toBeTruthy();
		const duration = tab.el.querySelector<HTMLInputElement>(
			'[data-ribbon-control="animations.timing.duration"]',
		);
		expect(duration?.disabled).toBeTruthy();
	});

	it('needs a selected element and edit permission before an effect can be applied', () => {
		const tab = createAnimationsTab(document, createTranslator(), handlers(), vi.fn());
		tab.update({ editable: true, hasSelection: false, animations: [] });
		expect(presetButtons(tab, 'animations.animation.gallery')[0].disabled).toBeTruthy();
		expect(presetButtons(tab, 'animations.motionPath.gallery')[0].disabled).toBeTruthy();
		expect(command(tab, 'animations.advancedAnimation.remove').disabled).toBeTruthy();
		tab.update({ editable: false, hasSelection: true, animations: [] });
		expect(presetButtons(tab, 'animations.animation.gallery')[0].disabled).toBeTruthy();
	});

	it('gives Motion Paths its own captioned ribbon group beside the presets', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		const gallery = tab.el.querySelector('[data-ribbon-control="animations.motionPath.gallery"]');
		expect(gallery?.getAttribute('aria-label')).toBe(t('pptx.animations.motionPathGalleryAria'));
		expect(gallery?.closest('pptx-ui-ribbon-group')?.getAttribute('label')).toBe(
			t('pptx.animation.motionPath'),
		);
		// Every catalogue path is reachable, exactly once, as a real button.
		expect(presetButtons(tab, 'animations.motionPath.gallery')).toHaveLength(
			MOTION_PATH_PRESETS.length,
		);
	});

	it('renders a read-only native-anchor row interleaved with editor rows, and it accepts a drop', () => {
		const t = createTranslator();
		const actions = handlers();
		const tab = createAnimationsTab(document, t, actions, vi.fn());
		tab.update({
			editable: true,
			hasSelection: true,
			animations: [{ elementId: 'el1', entrance: 'fadeIn', order: 1 }],
			animationTimelineAnchors: [{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] }],
		});

		const rows = tab.el.querySelectorAll('.pptxv-animation-timeline-row');
		expect(rows).toHaveLength(2);
		expect(rows[0].classList.contains('is-native')).toBeTruthy();
		expect(rows[0].getAttribute('draggable')).toBeNull();

		const dropEvent = new Event('drop', { cancelable: true }) as DragEvent & {
			dataTransfer: { getData: () => string };
		};
		Object.defineProperty(dropEvent, 'dataTransfer', { value: { getData: () => 'el1' } });
		rows[0].dispatchEvent(dropEvent);
		expect(actions.moveAnimation).toHaveBeenCalledWith('el1', 0);
	});

	it('shows an unset timing curve as linear (the writer saves accel=0 decel=0)', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		tab.update({
			editable: true,
			hasSelection: true,
			selectedElementId: 'el1',
			animations: [{ elementId: 'el1', entrance: 'fadeIn', order: 0 }],
		});
		const curve = control(tab, t('pptx.animation.timingCurve')) as HTMLSelectElement;
		expect(curve.value).toBe('linear');
	});

	it('offers a direction only when PowerPoint has variants for the preset', () => {
		const t = createTranslator();
		const tab = createAnimationsTab(document, t, handlers(), vi.fn());
		const state = (entrance: 'wipeIn' | 'fadeIn') => ({
			editable: true,
			hasSelection: true,
			selectedElementId: 'el1',
			animations: [{ elementId: 'el1', entrance, order: 0 }],
		});
		const direction = control(tab, t('pptx.animation.direction')) as HTMLSelectElement;

		tab.update(state('wipeIn'));
		expect(direction.closest('label')?.hidden).toBeFalsy();
		expect(direction.value).toBe('fromBottom');

		tab.update(state('fadeIn'));
		expect(direction.closest('label')?.hidden).toBeTruthy();
	});

	it('applies the motion path its gallery button names', () => {
		const actions = handlers();
		const tab = createAnimationsTab(document, createTranslator(), actions, vi.fn());
		tab.update(selected);
		preset(tab, 'arcUp').click();
		expect(actions.applyMotionPath).toHaveBeenCalledWith('arcUp');
	});
});
