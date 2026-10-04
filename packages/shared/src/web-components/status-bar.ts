import { defineStatusBar } from 'ooxml-ui/controls';
import type { OfficeStatusBarState, OfficeStatusButton } from 'ooxml-ui/controls';
import { registerIcon } from 'ooxml-ui/icons';

import type { StatusBarControlId, StatusBarIntent, StatusBarViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { bridgeCss } from './office-token-bridge';
import { STATUS_BAR_ICON_PATHS } from './status-bar-icons';

export type StatusBarRequestEvent = CustomEvent<StatusBarIntent>;
export interface PptxUiStatusBarElement extends HTMLElement {
	state: StatusBarViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-status-bar': PptxUiStatusBarElement;
	}
}

const ICON_PREFIX = 'pptx:status-';
const EMPTY_STATE: StatusBarViewState = { slideCount: 0, activeSlideIndex: 0, saveText: '' };

/** The pptx model (slide counter, views, i18n keys) resolved into the shared bar's state. */
export function officeStatusBarState(state: StatusBarViewState): OfficeStatusBarState {
	const t = state.translate ?? ((key: string) => key);
	const count = Math.max(0, state.slideCount);
	const views = state.showViewModes !== false;
	const view = (id: StatusBarControlId, labelKey: string, shown = true): OfficeStatusButton => ({
		id,
		icon: `${ICON_PREFIX}${id}`,
		label: t(labelKey),
		pressed: state.viewMode === id,
		hidden: !views || !shown,
	});
	return {
		items: [
			{
				id: 'counter',
				live: true,
				text:
					count > 0
						? t('pptx.statusBar.slideOf', {
								current: Math.min(Math.max(state.activeSlideIndex, 0) + 1, count),
								total: count,
							})
						: t('pptx.statusBar.noSlides'),
			},
			{ id: 'language', text: t('pptx.statusBar.language'), narrowHide: true },
			{ id: 'save', text: state.saveText, tone: state.saveKind, narrowHide: true },
		],
		toggles: [
			{
				id: 'notes',
				icon: `${ICON_PREFIX}notes`,
				label: t('pptx.statusBar.toggleNotes'),
				text: t('pptx.notes.title'),
				pressed: state.notesExpanded === true,
				hidden: !state.showNotes,
			},
		],
		// Every control stays rendered and named; gating only hides it.
		views: [
			view('normal', 'pptx.statusBar.normalView'),
			view('sorter', 'pptx.statusBar.slideSorter', state.showSorter !== false),
			view('slideShow', 'pptx.statusBar.slideShow', state.showSlideShow !== false),
		],
		zoom: {
			percent: state.zoomPercent ?? 100,
			hidden: state.zoomPercent === undefined,
			outLabel: t('pptx.statusBar.zoomOut'),
			fitLabel: t('pptx.statusBar.zoomToFit'),
			inLabel: t('pptx.statusBar.zoomIn'),
			outIcon: `${ICON_PREFIX}zoomOut`,
			inIcon: `${ICON_PREFIX}zoomIn`,
		},
	};
}

/**
 * `pptx-ui-status-bar`: the shared `office-ui-status-bar` in controlled mode under its published
 * pptx contract. Hosts set a `StatusBarViewState` and own every effect; activation emits one
 * bubbling, composed `status-request` `{ id }`. The `collaboration` slot holds the host's
 * connection indicator.
 */
export function definePptxStatusBar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-status-bar')) {
		return;
	}
	for (const [name, d] of Object.entries(STATUS_BAR_ICON_PATHS)) {
		registerIcon(`${ICON_PREFIX}${name}`, { d, viewBox: '0 0 16 16' });
	}
	defineStatusBar(registry);
	const Base = registry.get('office-ui-status-bar') as unknown as new () => HTMLElement & {
		connectedCallback(): void;
	};
	const setShared = Object.getOwnPropertyDescriptor(Base.prototype, 'state')!.set!;
	class PptxStatusBar extends Base {
		static activateEvent = 'status-request';
		#model: StatusBarViewState = EMPTY_STATE;
		constructor() {
			super();
			if (this.shadowRoot) {
				attachControlStyles(this.shadowRoot, bridgeCss('pptx-ui-status-bar'));
			}
		}
		override connectedCallback(): void {
			super.connectedCallback();
			// A host that never sets state still gets the controlled bar; constructors may not
			// add attributes, so the first sync waits for connection.
			this.#sync();
		}
		get state(): StatusBarViewState {
			return this.#model;
		}
		set state(value: StatusBarViewState) {
			this.#model = value;
			this.#sync();
		}
		#sync(): void {
			setShared.call(this, officeStatusBarState(this.#model));
		}
	}
	registry.define('pptx-ui-status-bar', PptxStatusBar);
}
