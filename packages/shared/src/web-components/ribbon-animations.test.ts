// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	canRequestAnimations,
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
	MOTION_PATH_PRESETS,
} from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());
function mount(state: Partial<HTMLElementTagNameMap['pptx-ui-ribbon-animations']['state']> = {}) {
	const host = document.createElement('pptx-ui-ribbon-animations');
	host.state = { editable: true, hasSelection: true, ...state };
	document.body.append(host);
	return host;
}
function button(host: HTMLElement, id: string) {
	return host
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}
const intents = (request: ReturnType<typeof vi.fn>) =>
	request.mock.calls.map(([event]) => event.detail);

describe('shared Animations view', () => {
	it('keeps every public group and control id exactly once', () => {
		const host = mount();
		for (const id of [
			'animations.preview',
			'animations.animation',
			'animations.motionPath',
			'animations.advancedAnimation',
			'animations.timing',
		]) {
			expect(host.querySelectorAll(`[data-ribbon-group="${id}"]`)).toHaveLength(1);
		}
		for (const id of [
			'animations.preview.preview',
			'animations.animation.gallery',
			'animations.animation.effectOptions',
			'animations.motionPath.gallery',
			'animations.advancedAnimation.addAnimation',
			'animations.advancedAnimation.animationPane',
			'animations.advancedAnimation.trigger',
			'animations.advancedAnimation.animationPainter',
			'animations.advancedAnimation.remove',
			'animations.timing.start',
			'animations.timing.duration',
		]) {
			expect(host.querySelectorAll(`[data-ribbon-control="${id}"]`)).toHaveLength(1);
		}
		expect(host.querySelectorAll('[data-animation-preset]')).toHaveLength(
			ENTRANCE_PRESET_VALUES.length +
				EMPHASIS_PRESET_VALUES.length +
				EXIT_PRESET_VALUES.length +
				MOTION_PATH_PRESETS.length,
		);
	});

	it('dispatches one typed intent per command, preset and motion path', () => {
		const host = mount();
		const request = vi.fn();
		host.addEventListener('animations-request', request);
		button(host, 'animations.preview.preview').click();
		button(host, 'animations.advancedAnimation.addAnimation').click();
		button(host, 'animations.advancedAnimation.remove').click();
		host.querySelector<HTMLButtonElement>('[data-animation-preset="flyIn"]')!.click();
		host.querySelector<HTMLButtonElement>('[data-animation-preset="lineRight"]')!.click();
		host.querySelectorAll('pptx-ui-ribbon-command')[2].shadowRoot!.querySelector('button')!.click();
		expect(intents(request)).toStrictEqual([
			{ kind: 'command', value: 'preview' },
			{ kind: 'add', group: 'exit', preset: 'fadeOut' },
			{ kind: 'command', value: 'remove' },
			{ kind: 'add', group: 'entrance', preset: 'flyIn' },
			{ kind: 'add', group: 'motionPath', preset: 'lineRight' },
			{ kind: 'add', group: 'motionPath', preset: 'lineRight' },
		]);
	});

	it('gates selection-dependent controls but keeps the pane and placeholders honest', () => {
		const host = mount({ hasSelection: false, paneOpen: true });
		const request = vi.fn();
		host.addEventListener('animations-request', request);
		expect(button(host, 'animations.preview.preview').disabled).toBeTruthy();
		expect(button(host, 'animations.animation.effectOptions').disabled).toBeTruthy();
		expect(host.querySelector<HTMLButtonElement>('[data-animation-preset]')!.disabled).toBeTruthy();
		const pane = button(host, 'animations.advancedAnimation.animationPane');
		expect(pane.disabled).toBeFalsy();
		expect(pane.getAttribute('aria-pressed')).toBe('true');
		pane.click();
		expect(intents(request)).toStrictEqual([{ kind: 'command', value: 'animationPane' }]);
		host.state = { editable: true, hasSelection: true, previewActive: true };
		expect(pane.getAttribute('aria-pressed')).toBe('false');
		expect(button(host, 'animations.advancedAnimation.animationPainter').disabled).toBeTruthy();
		expect(host.querySelector<HTMLInputElement>('input')!.disabled).toBeTruthy();
		expect(host.querySelector('pptx-ui-select')!.disabled).toBeTruthy();
		expect(
			host
				.querySelector('[data-ribbon-control="animations.preview.preview"]')!
				.hasAttribute('active'),
		).toBeTruthy();
	});

	it('rejects malformed or read-only intents', () => {
		const state = { editable: true, hasSelection: true };
		expect(
			canRequestAnimations(state, { kind: 'add', group: 'entrance', preset: 'bogus' }),
		).toBeFalsy();
		expect(
			canRequestAnimations(state, { kind: 'add', group: 'exit', preset: 'flyIn' }),
		).toBeFalsy();
		expect(
			canRequestAnimations(state, { kind: 'add', group: 'motionPath', preset: 'x' }),
		).toBeFalsy();
		expect(canRequestAnimations(state, { kind: 'command', value: 'x' as never })).toBeFalsy();
		const readOnly = { ...state, editable: false };
		expect(canRequestAnimations(readOnly, { kind: 'command', value: 'remove' })).toBeFalsy();
		expect(
			canRequestAnimations(readOnly, { kind: 'command', value: 'animationPane' }),
		).toBeTruthy();
		const host = mount({ editable: false });
		const request = vi.fn();
		host.addEventListener('animations-request', request);
		host.querySelector<HTMLButtonElement>('[data-animation-preset]')!.click();
		expect(request).not.toHaveBeenCalled();
	});

	it('preserves focus, instance isolation and reconnect without duplicates', () => {
		const first = mount(),
			second = mount({ hasSelection: false });
		const preset = first.querySelector<HTMLButtonElement>('[data-animation-preset="fadeIn"]')!;
		preset.focus();
		first.state = { ...first.state, paneOpen: true };
		expect(document.activeElement).toBe(preset);
		expect(
			second.querySelector<HTMLButtonElement>('[data-animation-preset="fadeIn"]')!.disabled,
		).toBeTruthy();
		first.remove();
		document.body.append(first);
		expect(first.querySelectorAll('[data-ribbon-group="animations.preview"]')).toHaveLength(1);
		const request = vi.fn();
		first.addEventListener('animations-request', request);
		preset.click();
		expect(request).toHaveBeenCalledOnce();
	});

	it('uses translations when supplied and readable fallbacks otherwise', () => {
		const host = mount({
			translate: (key) => (key === 'pptx.animations.preview' ? 'Vorschau' : key),
		});
		expect(
			host.querySelector('[data-ribbon-group="animations.preview"]')!.getAttribute('label'),
		).toBe('Vorschau');
		expect(host.querySelector('[data-animation-preset="fadeIn"]')!.textContent).toBe('Fade In');
	});
});

describe('shared Animations timing placeholders', () => {
	it('names the duration input, whose caption is a span rather than a label', () => {
		const host = mount();
		const duration = host.querySelector<HTMLInputElement>(
			'[data-ribbon-control="animations.timing.duration"]',
		)!;
		expect(duration.getAttribute('aria-label')).toBe('Duration');
		const start = host.querySelector<HTMLSelectElement>(
			'[data-ribbon-control="animations.timing.start"]',
		)!;
		expect(host.querySelector(`label[for="${start.id}"]`)!.textContent).toBe('Start');
		expect(mount().querySelector('pptx-ui-select')!.id).not.toBe(start.id);
	});
});

describe('shared Animations touch contract', () => {
	it('opts every effect button out of native generic button size resets', () => {
		const host = mount();
		const buttons = [...host.querySelectorAll<HTMLButtonElement>('[data-animation-preset]')];
		expect(buttons.length).toBeGreaterThan(50);
		expect(buttons.every((item) => item.hasAttribute('data-pptx-compact'))).toBeTruthy();
	});
});

describe('shared Animations gallery structure', () => {
	it('groups motion paths under the five families and effects under the three buckets (fallback captions)', () => {
		const host = mount({ translate: (key) => key });
		const captions = (id: string) =>
			[...host.querySelectorAll(`[data-ribbon-control="${id}"] .caption`)].map(
				(node) => node.textContent,
			);
		expect(captions('animations.motionPath.gallery')).toStrictEqual([
			'Lines',
			'Arcs',
			'Turns',
			'Shapes',
			'Loops',
		]);
		expect(captions('animations.animation.gallery')).toStrictEqual([
			'Entrance',
			'Emphasis',
			'Exit',
		]);
		const gallery = host.querySelector('[data-ribbon-control="animations.motionPath.gallery"]')!;
		expect(gallery.getAttribute('role')).toBe('group');
		expect(gallery.getAttribute('aria-label')).toBe(
			'Motion Paths: Lines, Arcs, Turns, Shapes, and Loops',
		);
	});
});
