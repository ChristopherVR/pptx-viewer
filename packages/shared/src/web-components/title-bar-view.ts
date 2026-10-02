import { resolveTitleBarStrip, TITLE_BAR_DEFAULT_FILE_KEY } from '../render';
import type {
	TitleBarEventDetails,
	TitleBarPlacement,
	TitleBarStripItem,
	TitleBarViewState,
} from '../render';
import { TITLE_BAR_ICON_PATHS } from './title-bar-icons';
import { createTitleBarSearch } from './title-bar-search';

const SVG_NS = 'http://www.w3.org/2000/svg';
const identity = (key: string): string => key;

export type TitleBarEmit = <K extends keyof TitleBarEventDetails>(
	name: K,
	detail: TitleBarEventDetails[K],
) => void;

/** The strip's button for one command; built once and patched in place. */
function createStripButton(doc: Document, item: TitleBarStripItem): HTMLButtonElement {
	const button = doc.createElement('button');
	button.type = 'button';
	button.dataset.command = item.id;
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('aria-hidden', 'true');
	const path = doc.createElementNS(SVG_NS, 'path');
	path.setAttribute('d', TITLE_BAR_ICON_PATHS[item.icon] ?? '');
	svg.append(path);
	button.append(svg);
	return button;
}

/**
 * Build the title bar once; `render` patches text, state and visibility. Strip
 * buttons are keyed by command id so a focused button survives every update.
 */
export function createTitleBarView(doc: Document, emit: TitleBarEmit) {
	const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '') => {
		const node = doc.createElement(tag);
		node.className = className;
		return node;
	};
	const sep = () => {
		const node = el('i', 'sep');
		node.setAttribute('aria-hidden', 'true');
		return node;
	};
	const logo = el('span', 'logo');
	logo.textContent = 'P';
	logo.setAttribute('aria-hidden', 'true');
	const autosave = el('span', 'autosave');
	const autosaveLabel = el('span', 'label');
	// The shared switch primitive; the host owns the state, so a change is a request.
	const toggle = el('pptx-ui-switch' as 'span', 'switch') as unknown as HTMLElement & {
		checked: boolean;
		disabled: boolean;
	};
	let autosaveEnabled = false;
	const autosaveState = el('span', 'label');
	autosave.append(autosaveLabel, toggle, autosaveState);
	toggle.addEventListener('change', () => {
		emit('toggle-autosave', null);
		// Stay controlled: show the host's state, not the switch's optimistic flip.
		toggle.checked = autosaveEnabled;
	});

	const sepAutosave = sep();
	const qat = el('div', 'qat');
	qat.setAttribute('role', 'toolbar');
	const sepStrip = sep();
	const buttons = new Map<string, HTMLButtonElement>();
	let stop = '';
	const enabled = () => [...qat.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
	const syncRoving = (): void => {
		const list = enabled();
		const current = list.find((b) => b.dataset.command === stop) ?? list[0];
		for (const button of buttons.values()) {
			button.tabIndex = button === current ? 0 : -1;
		}
	};
	qat.addEventListener('focusin', (event) => {
		const target = (event.target as Element).closest('button');
		if (target?.dataset.command) {
			stop = target.dataset.command;
			syncRoving();
		}
	});
	qat.addEventListener('keydown', (event) => {
		if (event.ctrlKey || event.metaKey || event.altKey) {
			return;
		}
		const list = enabled();
		const index = list.findIndex((b) => b === (event.target as Element).closest('button'));
		const last = list.length - 1;
		const next =
			event.key === 'ArrowRight'
				? (index + 1) % list.length
				: event.key === 'ArrowLeft'
					? (index + last) % list.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: -1;
		if (next >= 0 && index >= 0) {
			event.preventDefault();
			list[next]?.focus();
		}
		// Keep native activation and arrows out of the viewer's slide shortcuts.
		if (next >= 0 || event.key === ' ' || event.key === 'Enter') {
			event.stopPropagation();
		}
	});

	const fileName = el('span', 'name');
	const dot = el('span', 'dot');
	dot.textContent = '•';
	dot.setAttribute('aria-hidden', 'true');
	const status = el('span', 'status');
	const file = el('span', 'file');
	file.append(fileName, dot, status);

	const search = createTitleBarSearch(doc, (detail) => emit('command-search', detail));
	const searchWrap = el('span', 'search');
	searchWrap.append(search.box);
	const end = el('div', 'end');
	for (const name of ['collaboration', 'account']) {
		const slot = doc.createElement('slot');
		slot.name = name;
		end.append(slot);
	}
	const bar = el('div', 'bar');
	bar.setAttribute('part', 'bar');
	const full = [logo, autosave, sepAutosave, qat, sepStrip, file, searchWrap, end];
	const stripOnly = [qat];
	let laidOut: TitleBarPlacement = 'titleBar';
	bar.append(...full);

	const flags = { empty: false };
	return {
		bar,
		flags,
		render(state: TitleBarViewState, placement: TitleBarPlacement) {
			const t = state.translate ?? identity;
			const tip = state.screenTip ?? ((label: string) => label);
			const below = placement === 'belowRibbon';
			// The below-ribbon row carries only the strip: the rest leaves the DOM, so
			// one page never holds a second (hidden) search field or AutoSave switch.
			if (laidOut !== placement) {
				bar.replaceChildren(...(below ? stripOnly : full));
				laidOut = placement;
			}
			const items = resolveTitleBarStrip(state, placement);
			flags.empty = below && items.length === 0;
			bar.classList.toggle('below', below);
			for (const node of [logo, file, searchWrap, end]) {
				node.hidden = below;
			}
			autosave.hidden = below || !state.editing;
			sepAutosave.hidden = below || !state.editing;
			dot.hidden = status.hidden = !state.editing;
			sepStrip.hidden = below || items.length === 0;
			fileName.textContent = state.fileName || t(TITLE_BAR_DEFAULT_FILE_KEY);
			autosaveLabel.textContent = t('pptx.titleBar.autoSave');
			autosaveState.textContent = t(
				state.autosave.enabled ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff',
			);
			const available = state.autosave.toggleAvailable !== false;
			toggle.disabled = !available;
			autosaveEnabled = state.autosave.enabled;
			toggle.checked = autosaveEnabled;
			toggle.setAttribute('aria-label', t('pptx.titleBar.toggleAutoSave'));
			toggle.title = available
				? t('pptx.titleBar.toggleAutoSave')
				: t('pptx.autosave.disabledByHost');
			status.textContent = t(state.autosave.statusKey);
			const tone = state.autosave.enabled ? state.autosave.tone : 'idle';
			status.classList.toggle('saving', tone === 'saving');
			status.classList.toggle('error', tone === 'error');
			search.box.hidden = !state.searchVisible;
			search.render(state);

			qat.hidden = items.length === 0;
			qat.setAttribute('aria-label', t('pptx.options.quickAccess.label'));
			for (const id of [...buttons.keys()]) {
				if (!items.some((item) => item.id === id)) {
					buttons.get(id)?.remove();
					buttons.delete(id);
				}
			}
			for (const item of items) {
				let button = buttons.get(item.id);
				if (!button) {
					button = createStripButton(doc, item);
					const id = item.id;
					button.addEventListener('click', () =>
						id === 'save' || id === 'undo' || id === 'redo'
							? emit(id, null)
							: emit('quick-command', { id }),
					);
					buttons.set(item.id, button);
				}
				const label = t(item.id === 'save' ? 'pptx.titleBar.save' : item.labelKey);
				const pending =
					item.id === 'undo'
						? state.history.undoLabel
						: item.id === 'redo'
							? state.history.redoLabel
							: null;
				const tooltip = pending
					? t(item.id === 'undo' ? 'pptx.toolbar.undoAction' : 'pptx.toolbar.redoAction', {
							action: pending,
						})
					: label;
				const title = tip(tooltip);
				if (title === undefined) {
					button.removeAttribute('title');
				} else {
					button.title = title;
				}
				button.setAttribute('aria-label', label);
				button.disabled =
					(item.id === 'undo' && !state.history.canUndo) ||
					(item.id === 'redo' && !state.history.canRedo);
				let text = button.querySelector('small');
				if (state.quickAccess.showCommandLabels) {
					text ??= button.appendChild(doc.createElement('small'));
					text.textContent = label;
				} else {
					text?.remove();
				}
			}
			// Reorder only when the order really changed: moving a focused node blurs it.
			const current = [...qat.children];
			if (items.some((item, index) => current[index] !== buttons.get(item.id))) {
				qat.append(...items.map((item) => buttons.get(item.id)!));
			}
			syncRoving();
		},
	};
}
