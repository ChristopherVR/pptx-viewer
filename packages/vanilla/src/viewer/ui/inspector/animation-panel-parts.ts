import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { animationEffectLabel, buildAnimationTimelineBars } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorHandlers } from './types';

/** Short display label for an element: leading text if any, else its type. */
export function elementDisplayLabel(element: PptxElement): string {
	if (hasTextProperties(element) && element.text) {
		return element.text.slice(0, 24);
	}
	return element.type;
}

/** Display label for an animation row: element text if any, else its type. */
export function animationTargetLabel(
	animation: PptxElementAnimation,
	elements: readonly PptxElement[],
): string {
	const element = elements.find((entry) => entry.id === animation.elementId);
	if (!element) {
		return animation.elementId.slice(0, 8);
	}
	return elementDisplayLabel(element);
}

function animationKind(animation: PptxElementAnimation): 'entrance' | 'emphasis' | 'exit' | 'none' {
	if (animation.entrance) {
		return 'entrance';
	}
	if (animation.emphasis) {
		return 'emphasis';
	}
	if (animation.exit) {
		return 'exit';
	}
	return 'none';
}

/**
 * The horizontal timeline bar: one proportional segment per slide animation
 * (delay = offset, duration = width), colour-coded by effect kind and
 * highlighting the selected element (React's `AnimationTimelineSection` bar).
 */
export function renderTimelineBar(
	doc: Document,
	t: Translator,
	bar: HTMLElement,
	ordered: readonly PptxElementAnimation[],
	elements: readonly PptxElement[],
	selectedElementId: string | undefined,
): void {
	const bars = buildAnimationTimelineBars(ordered);
	bar.replaceChildren(
		...ordered.map((animation, index) => {
			const seg = createEl(doc, 'div', 'pptxv-anim-bar-seg');
			seg.classList.add(`is-${animationKind(animation)}`);
			seg.classList.toggle('is-selected', animation.elementId === selectedElementId);
			seg.style.left = `${bars[index].leftPercent}%`;
			seg.style.width = `${bars[index].widthPercent}%`;
			// Named through the shared resolver: the tooltip used to print the raw
			// preset token (`fadeIn`) where the effect's name belongs.
			const effect = animationEffectLabel(animation, t);
			seg.title = `${animationTargetLabel(animation, elements)} - ${effect} (${animation.durationMs ?? 500}ms)`;
			return seg;
		}),
	);
}

/**
 * A read-only row for one of the deck's own effect groups: no move buttons,
 * since it never moves on its own, but it stays a visible anchor an
 * editor-authored effect's up/down buttons can cross.
 */
export function renderNativeOrderRow(
	doc: Document,
	t: Translator,
	targetIds: readonly string[],
	index: number,
	elements: readonly PptxElement[],
): HTMLElement {
	const row = createEl(doc, 'div', 'pptxv-animation-timeline-row');
	row.classList.add('is-native');
	row.title = t('pptx.animation.nativeEffectHint');
	const label = createEl(doc, 'span', 'pptxv-animation-timeline-name');
	const names = targetIds
		.map((id) => {
			const element = elements.find((entry) => entry.id === id);
			return element ? elementDisplayLabel(element) : id.slice(0, 8);
		})
		.join(', ');
	label.textContent = `${index + 1}. ${t('pptx.animation.nativeEffect')}: ${names}`;
	row.append(label);
	return row;
}

/**
 * One reorderable play-order row: index, target label, effect kind, and move
 * up/down buttons (buttons instead of React's drag-drop).
 */
export function renderOrderRow(
	doc: Document,
	t: Translator,
	animation: PptxElementAnimation,
	index: number,
	total: number,
	elements: readonly PptxElement[],
	selectedElementId: string | undefined,
	editable: boolean,
	reorder: InspectorHandlers['reorderAnimation'],
): HTMLElement {
	const row = createEl(doc, 'div', 'pptxv-animation-timeline-row');
	row.classList.toggle('is-selected', animation.elementId === selectedElementId);
	const label = createEl(doc, 'span', 'pptxv-animation-timeline-name');
	label.textContent = `${index + 1}. ${animationTargetLabel(animation, elements)}`;
	const makeMove = (dir: 'up' | 'down', text: string, disabled: boolean): HTMLButtonElement => {
		const btn = createEl(doc, 'button', 'pptxv-btn');
		btn.type = 'button';
		btn.textContent = text;
		btn.setAttribute(
			'aria-label',
			t(dir === 'up' ? 'pptx.animation.moveUp' : 'pptx.animation.moveDown'),
		);
		btn.disabled = disabled;
		btn.addEventListener('click', () => reorder(animation.elementId, dir));
		return btn;
	};
	row.append(
		label,
		makeMove('up', '↑', !editable || index === 0),
		makeMove('down', '↓', !editable || index === total - 1),
	);
	return row;
}
