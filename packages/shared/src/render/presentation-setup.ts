import type { PptxSlide } from 'pptx-viewer-core';

export interface PresentationLoopInput {
	loopContinuously?: boolean;
	showType?: string;
}

export function shouldLoopContinuously(input: PresentationLoopInput): boolean {
	return Boolean(input.loopContinuously) || input.showType === 'kiosk';
}

/**
 * PowerPoint's "On Mouse Click" advance gate. An on-slide click / tap / swipe
 * advances the show only when the current slide's transition allows it: a slide
 * whose transition sets `advanceOnClick` to false is advanced solely by timings
 * or by explicit navigation (keyboard, on-screen next/prev buttons). An
 * undefined flag defaults to allowed, preserving the historical
 * click-to-advance behaviour.
 *
 * Only the click / tap / swipe advance may consult this. Keyboard, on-screen
 * next/prev buttons and timed auto-advance must never be gated by it.
 */
export function isClickAdvanceAllowed(slide: PptxSlide | undefined): boolean {
	return slide?.transition?.advanceOnClick !== false;
}

/**
 * PowerPoint's "After: <n>" timed advance (`p:transition/@advTm`, milliseconds).
 *
 * Returns the delay a slide show must wait before stepping to the next slide on
 * its own, or `undefined` when the slide waits for input instead. Timings are
 * honoured unless the show is explicitly set to manual advance
 * (`PptxPresentationProperties.advanceMode === 'manual'`, surfaced here as
 * `useTimings: false`); an unset flag keeps them, matching PowerPoint's default
 * "Using timings, if present".
 *
 * This pairs with {@link isClickAdvanceAllowed}: a slide authored with
 * `advClick="0" advTm="…"` is advanced ONLY by this timer, so a binding that
 * honours the click gate without also running the timer leaves the show
 * permanently stuck on that slide with no visible response to input.
 */
export function resolveAutoAdvanceDelayMs(
	slide: PptxSlide | undefined,
	options?: { useTimings?: boolean },
): number | undefined {
	if (options?.useTimings === false) {
		return undefined;
	}
	const advanceAfterMs = slide?.transition?.advanceAfterMs;
	if (
		typeof advanceAfterMs !== 'number' ||
		!Number.isFinite(advanceAfterMs) ||
		advanceAfterMs < 0
	) {
		return undefined;
	}
	return advanceAfterMs;
}

/**
 * Click targets that own their own click during a running show and must never
 * also step the slide on: hyperlinks and action buttons (PowerPoint follows the
 * link instead of advancing), media transport, form controls, and anything
 * inside a dialog. `[data-pptx-action]` is the attribute every binding stamps
 * on an element carrying an on-click action.
 */
export const PRESENTATION_INERT_CLICK_SELECTOR =
	'a, button, input, select, textarea, video, audio, [data-pptx-action], [role="dialog"]';

/**
 * A media element only owns its click while it exposes native transport: with
 * no controls there is nothing on it to click, so it is as inert as any other
 * picture. This matters for a full-bleed background video, which covers the
 * ENTIRE slide: treating it as interactive would swallow every click on that
 * slide and leave the presenter unable to advance at all.
 */
function isInertMedia(node: Element): boolean {
	return (
		(node.tagName === 'VIDEO' || node.tagName === 'AUDIO') && !(node as HTMLMediaElement).controls
	);
}

/**
 * Whether a click on `target` is PowerPoint's "On Mouse Click" advance rather
 * than an interaction with live slide content or show chrome.
 *
 * Only decides whether the click *reaches* the advance; whether the advance is
 * then allowed is {@link isClickAdvanceAllowed}'s job.
 */
export function isPresentationAdvanceClick(target: unknown): boolean {
	if (typeof Element === 'undefined' || !(target instanceof Element)) {
		return false;
	}
	for (let node: Element | null = target; node !== null; node = node.parentElement) {
		if (isInertMedia(node)) {
			continue;
		}
		if (node.matches(PRESENTATION_INERT_CLICK_SELECTOR)) {
			return false;
		}
	}
	return true;
}

export function applyRehearsalTimings(
	slides: readonly PptxSlide[],
	timings: Readonly<Record<number, number>>,
): PptxSlide[] {
	return slides.map((slide, index) => {
		const advanceAfterMs = timings[index];
		if (typeof advanceAfterMs !== 'number') {
			return slide;
		}
		return {
			...slide,
			transition: {
				...slide.transition,
				type: slide.transition?.type ?? 'none',
				advanceAfterMs,
			},
		};
	});
}

export interface EntranceAnimationEntry {
	entrance?: boolean;
	order?: number;
	elementId: string;
	delayMs?: number;
	[key: string]: unknown;
}

export function sortEntranceAnimations<T extends EntranceAnimationEntry>(
	animations: readonly T[],
): T[] {
	return [...animations]
		.filter(({ entrance }) => Boolean(entrance))
		.sort(
			(left, right) =>
				(left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER),
		);
}

export function computeEntranceAnimationDelay(
	delayMs: number | undefined,
	animationIndex: number,
): number {
	return Math.max(0, delayMs || 0) + animationIndex * 60;
}
