import { animationsLabel } from '../render';
import type { RibbonAnimationsViewState } from '../render';
import { RIBBON_ICON_PATHS } from './ribbon-icons';

const START_MODES: [key: string, fallback: string][] = [
	['pptx.animations.onClick', 'On Click'],
	['pptx.animations.withPrevious', 'With Previous'],
	['pptx.animations.afterPrevious', 'After Previous'],
];
let instance = 0;

/**
 * The Timing group's Start mode and Duration fields. They are disabled
 * placeholders in every binding: per-effect timing is authored in the
 * Animation Panel and the native play-order timeline, never from the ribbon.
 */
export function createAnimationsTimingView(doc: Document) {
	const el = doc.createElement('div');
	el.className = 'timing';
	instance += 1;
	const label = doc.createElement('label');
	const start = doc.createElement('select');
	start.id = `pptx-animations-start-${instance}`;
	start.dataset.ribbonControl = 'animations.timing.start';
	start.disabled = true;
	label.htmlFor = start.id;
	const modes = START_MODES.map(() => doc.createElement('option'));
	start.append(...modes);
	const caption = doc.createElement('span');
	const clock = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	clock.setAttribute('viewBox', '0 0 20 20');
	clock.setAttribute('aria-hidden', 'true');
	const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', RIBBON_ICON_PATHS.clock);
	clock.append(path);
	const text = doc.createElement('span');
	caption.append(clock, text);
	const duration = doc.createElement('input');
	duration.type = 'number';
	duration.min = '0';
	duration.step = '0.1';
	duration.value = '0.5';
	duration.disabled = true;
	duration.dataset.ribbonControl = 'animations.timing.duration';
	el.append(label, start, caption, duration);
	const sync = (state: RibbonAnimationsViewState) => {
		label.textContent = animationsLabel(state, 'pptx.animations.start', 'Start');
		START_MODES.forEach(([key, fallback], index) => {
			modes[index].textContent = animationsLabel(state, key, fallback);
		});
		text.textContent = animationsLabel(state, 'pptx.animations.duration', 'Duration');
		duration.setAttribute('aria-label', text.textContent);
	};
	return { el, sync };
}
