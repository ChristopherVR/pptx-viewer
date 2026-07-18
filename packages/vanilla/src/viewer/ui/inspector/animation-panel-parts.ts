import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { buildPreviewAnimation } from 'pptx-viewer-shared';

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
	bar: HTMLElement,
	ordered: readonly PptxElementAnimation[],
	elements: readonly PptxElement[],
	selectedElementId: string | undefined,
): void {
	let totalMs = 1;
	for (const animation of ordered) {
		totalMs = Math.max(totalMs, (animation.delayMs ?? 0) + (animation.durationMs ?? 500));
	}
	bar.replaceChildren(
		...ordered.map((animation) => {
			const seg = createEl(doc, 'div', 'pptxv-anim-bar-seg');
			seg.classList.add(`is-${animationKind(animation)}`);
			seg.classList.toggle('is-selected', animation.elementId === selectedElementId);
			const left = ((animation.delayMs ?? 0) / totalMs) * 100;
			const width = Math.max(((animation.durationMs ?? 500) / totalMs) * 100, 2);
			seg.style.left = `${left}%`;
			seg.style.width = `${width}%`;
			const effect = animation.entrance ?? animation.emphasis ?? animation.exit ?? 'custom';
			seg.title = `${animationTargetLabel(animation, elements)} - ${effect} (${animation.durationMs ?? 500}ms)`;
			return seg;
		}),
	);
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

/**
 * Play a one-shot canvas preview of the element's active effect by injecting
 * the shared `buildPreviewAnimation` keyframes and applying the shorthand to
 * the stage node for the element (React's `useAnimationPreview` DOM player).
 */
export function playAnimationPreview(
	doc: Document,
	animation: PptxElementAnimation | undefined,
): void {
	if (!animation) {
		return;
	}
	const preset = animation.entrance ?? animation.emphasis ?? animation.exit;
	if (!preset) {
		return;
	}
	const descriptor = buildPreviewAnimation(preset, {
		direction: animation.direction,
		durationMs: animation.durationMs,
		timingCurve: animation.timingCurve,
	});
	if (!descriptor) {
		return;
	}
	const target = doc.querySelector<HTMLElement>(
		`[data-element-id="${CSS.escape(animation.elementId)}"]`,
	);
	if (!target) {
		return;
	}
	const styleId = `pptxv-anim-preview-${descriptor.keyframeName}`;
	if (!doc.getElementById(styleId)) {
		const style = doc.createElement('style');
		style.id = styleId;
		style.textContent = descriptor.keyframesCss;
		(doc.head ?? doc.documentElement).appendChild(style);
	}
	target.style.animation = 'none';
	// Force a reflow so re-applying the same animation restarts it.
	void target.offsetWidth;
	target.style.animation = descriptor.cssAnimation;
	const clear = (): void => {
		target.style.animation = '';
	};
	target.addEventListener('animationend', clear, { once: true });
	setTimeout(clear, descriptor.durationMs + 250);
}
