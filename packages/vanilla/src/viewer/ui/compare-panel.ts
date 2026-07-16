import type { CompareResult, SlideDiff } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface ComparePanelOptions {
	result: CompareResult;
	onAccept(diff: SlideDiff): void;
	onAcceptAll(): void;
}

/** Docked presentation comparison surface backed by the shared diff engine. */
export function openComparePanel(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	options: ComparePanelOptions,
): void {
	host.querySelector('[data-pptx-compare-panel]')?.remove();
	const panel = createEl(doc, 'aside', 'pptxv-compare-panel');
	panel.dataset.pptxComparePanel = 'true';
	panel.setAttribute('aria-label', t('pptx.compare.title'));
	const header = createEl(doc, 'header');
	const titleWrap = createEl(doc, 'div');
	const title = createEl(doc, 'h2');
	title.textContent = t('pptx.compare.title');
	const summary = createEl(doc, 'p');
	summary.textContent = t('pptx.compare.summary', {
		added: options.result.addedCount,
		removed: options.result.removedCount,
		changed: options.result.changedCount,
	});
	titleWrap.append(title, summary);
	const close = createEl(doc, 'button');
	close.type = 'button';
	close.textContent = '×';
	close.setAttribute('aria-label', t('pptx.compare.close'));
	header.append(titleWrap, close);
	panel.appendChild(header);
	const actions = createEl(doc, 'div', 'pptxv-compare-actions');
	const acceptAll = createEl(doc, 'button');
	acceptAll.type = 'button';
	acceptAll.textContent = t('pptx.compare.acceptAll');
	acceptAll.addEventListener('click', () => {
		options.onAcceptAll();
		panel.remove();
	});
	actions.appendChild(acceptAll);
	panel.appendChild(actions);
	const list = createEl(doc, 'div', 'pptxv-compare-list');
	const diffs = options.result.diffs.filter((diff) => diff.status !== 'unchanged');
	if (diffs.length === 0) {
		const empty = createEl(doc, 'p');
		empty.textContent = t('pptx.compare.noDifferences');
		list.appendChild(empty);
	}
	for (const diff of diffs) {
		list.appendChild(createDiffRow(doc, t, diff, options.onAccept));
	}
	panel.appendChild(list);
	host.appendChild(panel);
	close.addEventListener('click', () => panel.remove());
}

function createDiffRow(
	doc: Document,
	t: Translator,
	diff: SlideDiff,
	onAccept: (diff: SlideDiff) => void,
): HTMLElement {
	const row = createEl(doc, 'article', 'pptxv-compare-row');
	const heading = createEl(doc, 'strong');
	heading.textContent = `${t('pptx.compare.slideNumber', { number: Math.max(diff.baseIndex, diff.compareIndex) + 1 })} · ${t(`pptx.compare.status${capitalize(diff.status)}`)}`;
	const details = createEl(doc, 'p');
	details.textContent =
		diff.changes.map((item) => item.description).join('; ') || heading.textContent;
	const controls = createEl(doc, 'div');
	const reject = createEl(doc, 'button');
	reject.type = 'button';
	reject.textContent = t('pptx.compare.reject');
	const accept = createEl(doc, 'button');
	accept.type = 'button';
	accept.textContent = t('pptx.compare.accept');
	reject.addEventListener('click', () => {
		row.classList.add('is-resolved');
		reject.disabled = true;
		accept.disabled = true;
	});
	accept.addEventListener('click', () => {
		onAccept(diff);
		row.classList.add('is-resolved');
		reject.disabled = true;
		accept.disabled = true;
	});
	controls.append(reject, accept);
	row.append(heading, details, controls);
	return row;
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
