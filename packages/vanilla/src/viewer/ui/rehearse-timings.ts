import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface RehearseTimingsOptions {
	slideCount: number;
	currentSlide(): number;
	navigate(index: number): void;
	onSave(timings: Record<number, number>): void;
}

export function openRehearseTimings(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	options: RehearseTimingsOptions,
): void {
	host.querySelector('.pptxv-rehearse')?.remove();
	const hud = createEl(doc, 'aside', 'pptxv-rehearse');
	hud.setAttribute('aria-label', t('pptx.rehearse.summaryTitle'));
	const slide = createEl(doc, 'span');
	const time = createEl(doc, 'strong');
	const total = createEl(doc, 'span');
	const timings: Record<number, number> = {};
	let slideStarted = performance.now();
	let totalStarted = slideStarted;
	let pausedAt = 0;
	let pausedDuration = 0;
	let paused = false;
	const format = (ms: number): string => new Date(Math.max(0, ms)).toISOString().slice(14, 19);
	const button = (label: string, action: () => void): HTMLButtonElement => {
		const el = createEl(doc, 'button');
		el.type = 'button';
		el.textContent = label;
		el.addEventListener('click', action);
		hud.appendChild(el);
		return el;
	};
	const pause = button(t('pptx.rehearse.pause'), () => {
		paused = !paused;
		if (paused) {
			pausedAt = performance.now();
		} else {
			const delay = performance.now() - pausedAt;
			pausedDuration += delay;
			slideStarted += delay;
			totalStarted += delay;
		}
		pause.textContent = t(paused ? 'pptx.rehearse.resume' : 'pptx.rehearse.pause');
	});
	const commitCurrent = (): void => {
		timings[options.currentSlide()] = Math.max(
			250,
			performance.now() - slideStarted - pausedDuration,
		);
		pausedDuration = 0;
	};
	button(t('pptx.presenter.next'), () => {
		if (paused) {
			return;
		}
		commitCurrent();
		const next = options.currentSlide() + 1;
		if (next < options.slideCount) {
			options.navigate(next);
			slideStarted = performance.now();
		}
	});
	button(t('pptx.rehearse.saveTimings'), () => {
		commitCurrent();
		options.onSave(timings);
		hud.remove();
	});
	button(t('pptx.rehearse.discard'), () => hud.remove());
	hud.prepend(slide, time, total);
	const timer = window.setInterval(() => {
		if (paused) {
			return;
		}
		const now = performance.now();
		slide.textContent = `${t('pptx.rehearse.slide')} ${options.currentSlide() + 1}/${options.slideCount}`;
		time.textContent = `${t('pptx.rehearse.slideTime')}: ${format(now - slideStarted)}`;
		total.textContent = `${t('pptx.rehearse.totalTime')}: ${format(now - totalStarted)}`;
	}, 250);
	const observer = new MutationObserver(() => {
		if (!hud.isConnected) {
			clearInterval(timer);
			observer.disconnect();
		}
	});
	observer.observe(host, { childList: true });
	host.appendChild(hud);
}
