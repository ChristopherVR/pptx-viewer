import type { StatusBarControlId, StatusBarTranslate, StatusBarViewState } from '../render';
import { STATUS_BAR_ICON_PATHS } from './status-bar-icons';
import type { StatusBarIcon } from './status-bar-icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface ButtonSpec {
	id: StatusBarControlId;
	icon?: StatusBarIcon;
	labelKey: string;
	className: string;
}

const SPECS: readonly ButtonSpec[] = [
	{ id: 'notes', icon: 'notes', labelKey: 'pptx.statusBar.toggleNotes', className: 'notes' },
	{ id: 'normal', icon: 'normal', labelKey: 'pptx.statusBar.normalView', className: '' },
	{ id: 'sorter', icon: 'sorter', labelKey: 'pptx.statusBar.slideSorter', className: '' },
	{ id: 'slideShow', icon: 'slideShow', labelKey: 'pptx.statusBar.slideShow', className: '' },
	{ id: 'zoomOut', icon: 'zoomOut', labelKey: 'pptx.statusBar.zoomOut', className: 'zoom-step' },
	{ id: 'zoomFit', labelKey: 'pptx.statusBar.zoomToFit', className: 'zoom' },
	{ id: 'zoomIn', icon: 'zoomIn', labelKey: 'pptx.statusBar.zoomIn', className: 'zoom-step' },
];

const identity: StatusBarTranslate = (key) => key;

/** Build the status bar DOM once; `render` only patches text, state and visibility. */
export function createStatusBarView(
	doc: Document,
	request: (id: StatusBarControlId) => void,
): { bar: HTMLElement; render(state: StatusBarViewState): void } {
	const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '') => {
		const node = doc.createElement(tag);
		node.className = className;
		return node;
	};
	const sep = (className = 'sep') => {
		const node = el('i', className);
		node.setAttribute('aria-hidden', 'true');
		return node;
	};
	const buttons = {} as Record<StatusBarControlId, HTMLButtonElement>;
	const notesLabel = el('span', 'label');
	for (const spec of SPECS) {
		const button = el('button', spec.className);
		button.type = 'button';
		if (spec.icon) {
			const svg = doc.createElementNS(SVG_NS, 'svg');
			svg.setAttribute('viewBox', '0 0 16 16');
			svg.setAttribute('aria-hidden', 'true');
			const path = doc.createElementNS(SVG_NS, 'path');
			path.setAttribute('d', STATUS_BAR_ICON_PATHS[spec.icon]);
			svg.append(path);
			button.append(svg);
		}
		if (spec.id === 'notes') {
			button.append(notesLabel);
		}
		button.addEventListener('click', () => request(spec.id));
		// Keep native activation out of the viewer's slide-navigation handlers.
		button.addEventListener('keydown', (event) => {
			if (
				(event.key === ' ' || event.key === 'Enter') &&
				!event.ctrlKey &&
				!event.metaKey &&
				!event.altKey
			) {
				event.stopPropagation();
			}
		});
		buttons[spec.id] = button;
	}
	const counter = el('span', 'counter');
	counter.setAttribute('aria-live', 'polite');
	const language = el('span', 'text narrow-hide');
	const save = el('span', 'text narrow-hide save');
	const views = el('div', 'group');
	views.append(buttons.normal, buttons.sorter, buttons.slideShow);
	const collaboration = doc.createElement('slot');
	collaboration.name = 'collaboration';
	const collabSep = sep('sep tight');
	collabSep.hidden = true;
	collaboration.addEventListener('slotchange', () => {
		collabSep.hidden = collaboration.assignedNodes().length === 0;
	});
	const zoomSep = sep('sep tight');
	const zoom = el('div', 'group');
	zoom.append(buttons.zoomOut, buttons.zoomFit, buttons.zoomIn);
	const bar = el('div', 'bar');
	bar.setAttribute('part', 'bar');
	bar.append(
		counter,
		sep('sep narrow-hide'),
		language,
		sep('sep narrow-hide'),
		save,
		el('div', 'spacer'),
		buttons.notes,
		sep('sep tight'),
		views,
		collabSep,
		collaboration,
		zoomSep,
		zoom,
	);
	return {
		bar,
		render(state) {
			const t = state.translate ?? identity;
			const count = Math.max(0, state.slideCount);
			counter.textContent =
				count > 0
					? t('pptx.statusBar.slideOf', {
							current: Math.min(Math.max(state.activeSlideIndex, 0) + 1, count),
							total: count,
						})
					: t('pptx.statusBar.noSlides');
			language.textContent = t('pptx.statusBar.language');
			save.textContent = state.saveText;
			save.classList.toggle('saving', state.saveKind === 'saving');
			save.classList.toggle('error', state.saveKind === 'error');
			for (const spec of SPECS) {
				const text = t(spec.labelKey);
				buttons[spec.id].title = text;
				buttons[spec.id].setAttribute('aria-label', text);
			}
			notesLabel.textContent = t('pptx.notes.title');
			const pressed = (id: StatusBarControlId, value: boolean) =>
				buttons[id].setAttribute('aria-pressed', String(value));
			buttons.notes.hidden = !state.showNotes;
			pressed('notes', state.notesExpanded === true);
			views.hidden = state.showViewModes === false;
			buttons.sorter.hidden = state.showSorter === false;
			buttons.slideShow.hidden = state.showSlideShow === false;
			pressed('normal', state.viewMode === 'normal');
			pressed('sorter', state.viewMode === 'sorter');
			pressed('slideShow', state.viewMode === 'slideShow');
			zoomSep.hidden = zoom.hidden = state.zoomPercent === undefined;
			buttons.zoomFit.textContent = `${Math.round(state.zoomPercent ?? 100)}%`;
		},
	};
}
