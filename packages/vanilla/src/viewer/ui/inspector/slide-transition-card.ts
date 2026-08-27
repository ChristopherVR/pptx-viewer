import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { TRANSITION_VALID_DIRECTIONS } from 'pptx-viewer-core';
import {
	buildDirectionGrid,
	SLIDE_TRANSITION_OPTIONS,
	TRANSITION_DIR_ARROWS,
	TRANSITION_MORPH_OPTIONS,
	TRANSITION_ORIENTATION_TYPES,
	TRANSITION_SPEED_OPTIONS,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeNumberField } from '../controls';
import { makeCheckboxField } from './controls-extra';
import type { DeckCard } from './deck-card-helpers';
import { makeSection } from './deck-card-helpers';
import { createTransitionPreview } from './transition-preview';
import type { InspectorDeckState, InspectorHandlers } from './types';

/**
 * The SLIDE TRANSITION card (React's `SlideTransitionSection`, reached from its
 * `SlideProperties`): the active slide's transition type, its direction (arrow
 * grid) or orientation, wheel spokes, duration and advance-on-click flag.
 *
 * Every patch is merged onto the slide's existing transition through
 * `updateActiveSlide`, so changing the duration cannot drop an authored sound
 * or direction the deck already carried.
 */
export function createSlideTransitionCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'updateActiveSlide'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.slideInspector.slideTransition'));
	let transition: PptxSlideTransition | undefined;
	let editable = false;

	const patch = (changes: Partial<PptxSlideTransition>): void => {
		const next = { ...transition, ...changes } as PptxSlideTransition;
		transition = next;
		handlers.updateActiveSlide({ transition: next });
	};

	const typeLabel = createEl(doc, 'label', 'pptxv-field pptxv-field-select');
	const typeCaption = createEl(doc, 'span', 'pptxv-field-label');
	typeCaption.textContent = t('pptx.transition.type');
	const type = doc.createElement('select');
	type.className = 'pptxv-field-select-input';
	type.setAttribute('aria-label', t('pptx.transition.type'));
	for (const option of SLIDE_TRANSITION_OPTIONS) {
		const node = doc.createElement('option');
		node.value = option.value;
		node.textContent = t(option.i18nKey);
		type.appendChild(node);
	}
	type.addEventListener('change', () => patch({ type: type.value as PptxTransitionType }));
	typeLabel.append(typeCaption, type);

	const speedLabel = createEl(doc, 'label', 'pptxv-field pptxv-field-select');
	const speedCaption = createEl(doc, 'span', 'pptxv-field-label');
	speedCaption.textContent = t('pptx.transition.speed');
	const speed = doc.createElement('select');
	speed.className = 'pptxv-field-select-input';
	speed.setAttribute('aria-label', t('pptx.transition.speed'));
	for (const option of TRANSITION_SPEED_OPTIONS) {
		const node = doc.createElement('option');
		node.value = option.value;
		node.textContent = t(option.i18nKey);
		speed.appendChild(node);
	}
	speed.addEventListener('change', () =>
		patch({ speed: speed.value as PptxSlideTransition['speed'] }),
	);
	speedLabel.append(speedCaption, speed);

	const morphLabel = createEl(doc, 'label', 'pptxv-field pptxv-field-select');
	const morphCaption = createEl(doc, 'span', 'pptxv-field-label');
	morphCaption.textContent = t('pptx.transition.morphOption');
	const morphOption = doc.createElement('select');
	morphOption.className = 'pptxv-field-select-input';
	morphOption.setAttribute('aria-label', t('pptx.transition.morphOption'));
	for (const option of TRANSITION_MORPH_OPTIONS) {
		const node = doc.createElement('option');
		node.value = option.value;
		node.textContent = t(option.i18nKey);
		morphOption.appendChild(node);
	}
	morphOption.addEventListener('change', () =>
		patch({ morphOption: morphOption.value as PptxSlideTransition['morphOption'] }),
	);
	morphLabel.append(morphCaption, morphOption);

	const directions = createEl(doc, 'div', 'pptxv-transition-directions');
	const duration = makeNumberField(doc, {
		label: t('pptx.transition.duration'),
		min: 0,
		max: 10000,
		step: 10,
		onCommit: (value) => patch({ durationMs: Math.max(0, Math.min(10000, Math.round(value))) }),
	});
	const spokes = makeNumberField(doc, {
		label: t('pptx.transition.spokes'),
		min: 1,
		max: 8,
		onCommit: (value) => patch({ spokes: Math.max(1, Math.min(8, Math.round(value))) }),
	});
	const advance = makeCheckboxField(doc, {
		label: t('pptx.transition.advanceOnClick'),
		onChange: (checked) => patch({ advanceOnClick: checked }),
	});
	const sound = createEl(doc, 'p', 'pptxv-transition-sound');
	const preview = createTransitionPreview(doc, t);
	body.append(
		typeLabel,
		directions,
		spokes.el,
		duration.el,
		speedLabel,
		morphLabel,
		advance.el,
		sound,
		preview.el,
	);

	/** Repaint the direction/orientation picker for the active transition type. */
	const renderDirections = (current: PptxTransitionType): void => {
		directions.textContent = '';
		const valid = TRANSITION_VALID_DIRECTIONS[current];
		if (!valid || valid.length === 0) {
			directions.hidden = true;
			return;
		}
		directions.hidden = false;
		const caption = createEl(doc, 'span', 'pptxv-field-label');
		const usesOrientation = TRANSITION_ORIENTATION_TYPES.has(current);
		caption.textContent = t(
			usesOrientation ? 'pptx.transition.orientation' : 'pptx.transition.direction',
		);
		directions.appendChild(caption);

		const button = (value: string, text: string): HTMLButtonElement => {
			const node = createEl(doc, 'button', 'pptxv-transition-dir');
			node.type = 'button';
			node.textContent = text;
			// The raw OOXML token ("lu", "rd") names nothing a user recognises,
			// so both the tooltip and the accessible name read from the shared
			// dictionary the way React, Vue, Angular and Svelte do.
			const name = t(`pptx.transition.dir.${value}`);
			node.title = name;
			node.setAttribute('aria-label', name);
			node.classList.toggle('is-active', (transition?.direction ?? transition?.orient) === value);
			node.disabled = !editable;
			node.addEventListener('click', () =>
				patch(usesOrientation ? { orient: value as 'horz' | 'vert' } : { direction: value }),
			);
			return node;
		};

		if (usesOrientation) {
			const row = createEl(doc, 'div', 'pptxv-transition-dir-row');
			for (const value of ['horz', 'vert']) {
				row.appendChild(button(value, TRANSITION_DIR_ARROWS[value] ?? value));
			}
			directions.appendChild(row);
			return;
		}
		// Four or more compass directions read best on the 3x3 arrow grid React
		// uses; anything shorter (in/out) stays an inline row.
		const grid = buildDirectionGrid(valid);
		const hasGridCell = grid.some((row) => row.some(Boolean));
		if (hasGridCell) {
			const gridEl = createEl(doc, 'div', 'pptxv-transition-dir-grid');
			for (const row of grid) {
				for (const cell of row) {
					if (cell === null) {
						gridEl.appendChild(createEl(doc, 'span', 'pptxv-transition-dir-gap'));
					} else {
						gridEl.appendChild(button(cell, TRANSITION_DIR_ARROWS[cell] ?? cell));
					}
				}
			}
			directions.appendChild(gridEl);
			return;
		}
		const row = createEl(doc, 'div', 'pptxv-transition-dir-row');
		for (const value of valid) {
			row.appendChild(button(value, TRANSITION_DIR_ARROWS[value] ?? value));
		}
		directions.appendChild(row);
	};

	return {
		el,
		update(state: InspectorDeckState) {
			editable = state.editable;
			transition = state.activeSlide?.transition;
			el.hidden = !state.activeSlide;
			const current = transition?.type ?? 'none';
			type.value = current;
			type.disabled = !state.editable;
			renderDirections(current);
			spokes.el.hidden = current !== 'wheel';
			spokes.setValue(transition?.spokes ?? 4);
			spokes.setDisabled(!state.editable);
			duration.setValue(Math.round(transition?.durationMs ?? 320));
			duration.setDisabled(!state.editable);
			speed.value = transition?.speed ?? 'fast';
			speed.disabled = !state.editable;
			morphLabel.hidden = current !== 'morph';
			morphOption.value = transition?.morphOption ?? 'byObject';
			morphOption.disabled = !state.editable;
			advance.setValue(transition?.advanceOnClick !== false);
			advance.setDisabled(!state.editable);
			sound.hidden = !transition?.soundFileName;
			sound.textContent = transition?.soundFileName
				? `${t('pptx.transition.sound')}: ${transition.soundFileName}`
				: '';
			preview.update(transition);
		},
	};
}
