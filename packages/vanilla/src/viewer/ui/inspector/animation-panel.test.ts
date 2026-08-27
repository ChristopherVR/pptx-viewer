import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import type { AnimationPanelState } from './animation-panel';
import { createAnimationPanel } from './animation-panel';
import type { InspectorHandlers } from './types';

function makeHandlers() {
	return {
		setAnimationEffect: vi.fn<InspectorHandlers['setAnimationEffect']>(),
		applyMotionPath: vi.fn<InspectorHandlers['applyMotionPath']>(),
		setAnimationTiming: vi.fn<InspectorHandlers['setAnimationTiming']>(),
		reorderAnimation: vi.fn<InspectorHandlers['reorderAnimation']>(),
	};
}

function makeElement(id: string, text?: string): PptxElement {
	return { id, type: 'shape', x: 0, y: 0, width: 100, height: 100, text } as PptxElement;
}

function makeState(overrides: Partial<AnimationPanelState> = {}): AnimationPanelState {
	return {
		editable: true,
		selectedElementId: 'el1',
		elements: [makeElement('el1', 'Title'), makeElement('el2', 'Body')],
		animations: [],
		...overrides,
	};
}

const t = createTranslator();

describe('inspector animation panel', () => {
	it('is hidden without a selection and shown for the selected element', () => {
		const panel = createAnimationPanel(document, t, makeHandlers());
		panel.update(makeState({ selectedElementId: undefined }));
		expect(panel.el.hidden).toBeTruthy();
		panel.update(makeState());
		expect(panel.el.hidden).toBeFalsy();
	});

	it('offers entrance/emphasis/exit preset selects that dispatch setAnimationEffect', () => {
		const handlers = makeHandlers();
		const panel = createAnimationPanel(document, t, handlers);
		panel.update(makeState());

		const selects = panel.el.querySelectorAll<HTMLSelectElement>('.pptxv-anim-field select');
		const entrance = selects[0];
		expect(entrance.value).toBe('none');
		entrance.value = 'fadeIn';
		entrance.dispatchEvent(new Event('change'));
		expect(handlers.setAnimationEffect).toHaveBeenCalledWith('entrance', 'fadeIn');

		const exit = selects[2];
		exit.value = 'fadeOut';
		exit.dispatchEvent(new Event('change'));
		expect(handlers.setAnimationEffect).toHaveBeenCalledWith('exit', 'fadeOut');
	});

	it('reflects the selected element animation and hides options when there is none', () => {
		const panel = createAnimationPanel(document, t, makeHandlers());
		const options = panel.el.querySelector<HTMLElement>('.pptxv-anim-options');

		panel.update(makeState());
		expect(options?.hidden).toBeTruthy();

		const animations: PptxElementAnimation[] = [
			{ elementId: 'el1', entrance: 'flyIn', durationMs: 700, delayMs: 100, order: 0 },
		];
		panel.update(makeState({ animations }));
		expect(options?.hidden).toBeFalsy();
		const selects = panel.el.querySelectorAll<HTMLSelectElement>('.pptxv-anim-field select');
		expect(selects[0].value).toBe('flyIn');
		const duration = panel.el.querySelector<HTMLInputElement>('input[type="number"]');
		expect(duration?.value).toBe('700');
		// flyIn is directional: the direction row is shown.
		const direction = panel.el.querySelector<HTMLElement>('.pptxv-anim-direction');
		expect(direction?.hidden).toBeFalsy();
	});

	it('commits timing edits for the selected element via setAnimationTiming', () => {
		const handlers = makeHandlers();
		const panel = createAnimationPanel(document, t, handlers);
		panel.update(makeState({ animations: [{ elementId: 'el1', entrance: 'fadeIn', order: 0 }] }));

		const duration = panel.el.querySelector<HTMLInputElement>('input[type="number"]');
		duration!.value = '1200';
		duration!.dispatchEvent(new Event('change'));
		expect(handlers.setAnimationTiming).toHaveBeenCalledWith('el1', { durationMs: 1200 });

		const directionBtn = panel.el.querySelector<HTMLButtonElement>('.pptxv-anim-direction-btn');
		directionBtn!.click();
		expect(handlers.setAnimationTiming).toHaveBeenCalledWith('el1', { direction: 'fromTop' });
	});

	it('lists other slide elements as trigger shapes when the trigger is onShapeClick', () => {
		const panel = createAnimationPanel(document, t, makeHandlers());
		panel.update(
			makeState({
				animations: [{ elementId: 'el1', entrance: 'fadeIn', trigger: 'onShapeClick', order: 0 }],
			}),
		);
		const shapeSelect = panel.el.querySelectorAll<HTMLSelectElement>('.pptxv-anim-field select')[5];
		expect((shapeSelect.parentElement as HTMLElement).hidden).toBeFalsy();
		expect(Array.from(shapeSelect.options).map((o) => o.value)).toStrictEqual(['', 'el2']);
	});

	it('renders the play-order list with working move up/down buttons', () => {
		const handlers = makeHandlers();
		const panel = createAnimationPanel(document, t, handlers);
		panel.update(
			makeState({
				animations: [
					{ elementId: 'el1', entrance: 'fadeIn', order: 0 },
					{ elementId: 'el2', exit: 'fadeOut', order: 1 },
				],
			}),
		);

		const rows = panel.el.querySelectorAll('.pptxv-animation-timeline-row');
		expect(rows).toHaveLength(2);
		const segs = panel.el.querySelectorAll('.pptxv-anim-bar-seg');
		expect(segs).toHaveLength(2);

		const firstRowButtons = rows[0].querySelectorAll<HTMLButtonElement>('button');
		expect(firstRowButtons[0].disabled).toBeTruthy();
		firstRowButtons[1].click();
		expect(handlers.reorderAnimation).toHaveBeenCalledWith('el1', 'down');
	});

	it('renders a read-only row for a deck-native effect anchor, interleaved with editor rows', () => {
		const handlers = makeHandlers();
		const panel = createAnimationPanel(document, t, handlers);
		panel.update(
			makeState({
				animations: [{ elementId: 'el1', entrance: 'fadeIn', order: 1 }],
				animationTimelineAnchors: [{ order: 0, targetIds: ['el2'], presetClasses: ['entr'] }],
			}),
		);

		const rows = panel.el.querySelectorAll('.pptxv-animation-timeline-row');
		expect(rows).toHaveLength(2);
		expect(rows[0].classList.contains('is-native')).toBeTruthy();
		expect(rows[0].querySelectorAll('button')).toHaveLength(0);
		expect(rows[1].classList.contains('is-native')).toBeFalsy();

		// The editor row's "move up" button is enabled: it can still move ahead
		// of the native anchor even though it isn't the first editor entry.
		const editorButtons = rows[1].querySelectorAll<HTMLButtonElement>('button');
		expect(editorButtons[0].disabled).toBeFalsy();
		editorButtons[0].click();
		expect(handlers.reorderAnimation).toHaveBeenCalledWith('el1', 'up');
	});

	it('disables all controls when not editable', () => {
		const panel = createAnimationPanel(document, t, makeHandlers());
		panel.update(
			makeState({
				editable: false,
				animations: [{ elementId: 'el1', entrance: 'fadeIn', order: 0 }],
			}),
		);
		const controls = panel.el.querySelectorAll<HTMLSelectElement | HTMLInputElement>(
			'.pptxv-anim-field :is(select, input)',
		);
		for (const control of controls) {
			expect(control.disabled).toBeTruthy();
		}
	});
});
