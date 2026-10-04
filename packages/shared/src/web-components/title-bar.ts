import { defineTitleBar } from 'ooxml-ui/controls';
import type { OfficeTitleBarState } from 'ooxml-ui/controls';
import { registerIcon } from 'ooxml-ui/icons';

import { filterCommands, resolveTitleBarStrip, TITLE_BAR_DEFAULT_FILE_KEY } from '../render';
import type {
	TitleBarEventDetails,
	TitleBarPlacement,
	TitleBarSearchDetail,
	TitleBarViewState,
} from '../render';
import { attachControlStyles } from './control-styles';
import { bridgeCss } from './office-token-bridge';
import { TITLE_BAR_ICON_PATHS } from './title-bar-icons';

export type TitleBarEvent<K extends keyof TitleBarEventDetails> = CustomEvent<
	TitleBarEventDetails[K]
>;
export type TitleBarCommandSearchEvent = CustomEvent<TitleBarSearchDetail>;
export interface PptxUiTitleBarElement extends HTMLElement {
	state: TitleBarViewState | undefined;
	placement: TitleBarPlacement;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-title-bar': PptxUiTitleBarElement;
	}
}

/** Neutral state until the host supplies one: nothing editable, no strip. */
const EMPTY_STATE: TitleBarViewState = {
	editing: false,
	searchVisible: false,
	autosave: { enabled: false, statusKey: '' },
	history: { canUndo: false, canRedo: false },
	quickAccess: { visible: false, position: 'above', showCommandLabels: false, commandIds: [] },
};

const ICON_PREFIX = 'pptx:title-';
const identity = (key: string): string => key;

/** The pptx model (gating, catalogue, i18n keys) resolved into the shared element's state. */
export function officeTitleBarState(
	state: TitleBarViewState,
	placement: TitleBarPlacement,
): OfficeTitleBarState {
	const t = state.translate ?? identity;
	const tip = state.screenTip ?? ((label: string) => label);
	const available = state.autosave.toggleAvailable !== false;
	const items = resolveTitleBarStrip(state, placement).map((item) => {
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
		return {
			id: item.id,
			icon: `${ICON_PREFIX}${item.icon}`,
			label,
			title: tip(tooltip),
			disabled:
				(item.id === 'undo' && !state.history.canUndo) ||
				(item.id === 'redo' && !state.history.canRedo),
		};
	});
	return {
		appMark: 'P',
		fileName: state.fileName || t(TITLE_BAR_DEFAULT_FILE_KEY),
		status: state.editing ? t(state.autosave.statusKey) : undefined,
		tone: state.autosave.enabled ? state.autosave.tone : 'idle',
		autosave: state.editing
			? {
					enabled: state.autosave.enabled,
					available,
					label: t('pptx.titleBar.autoSave'),
					stateLabel: t(
						state.autosave.enabled ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff',
					),
					toggleLabel: t('pptx.titleBar.toggleAutoSave'),
					title: available ? t('pptx.titleBar.toggleAutoSave') : t('pptx.autosave.disabledByHost'),
				}
			: undefined,
		quickAccess: {
			label: t('pptx.options.quickAccess.label'),
			items,
			showLabels: state.quickAccess.showCommandLabels,
		},
		search: state.searchVisible
			? {
					placeholder: t('pptx.titleBar.searchPlaceholder'),
					label: t('pptx.titleBar.search'),
					heading: t('pptx.titleBar.searchCommands'),
					empty: t('pptx.titleBar.searchNoResults'),
					match: (query) =>
						filterCommands(query, t, state.commands).map((entry) => ({
							id: entry.command,
							label: t(entry.labelKey),
							category: entry.category,
						})),
					content:
						state.contentSearch === false
							? undefined
							: (query) => `${t('pptx.titleBar.searchContent')} “${query}”`,
					contentIcon: `${ICON_PREFIX}search`,
				}
			: undefined,
	};
}

/** The shared element's surface the alias builds on. */
interface SharedTitleBar extends HTMLElement {
	placement: TitleBarPlacement;
	readonly searchField: HTMLElement;
	connectedCallback(): void;
	attributeChangedCallback(): void;
}
type SharedTitleBarCtor = new () => SharedTitleBar;

/**
 * `pptx-ui-title-bar`: the shared `office-ui-title-bar` under its published pptx contract.
 * Hosts set a `TitleBarViewState`; the alias resolves gating, catalogue and translations and
 * keeps the events (`toggle-autosave`, `save`, `undo`, `redo`, `quick-command`,
 * `command-search`) and hooks (`[data-pptx-title-bar]`, `[data-pptx-quick-access="below"]`).
 * Named slots `collaboration` and `account` hold host-owned parts.
 */
export function definePptxTitleBar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-title-bar')) {
		return;
	}
	for (const [name, d] of Object.entries(TITLE_BAR_ICON_PATHS)) {
		registerIcon(`${ICON_PREFIX}${name}`, { d, viewBox: '0 0 16 16' });
	}
	defineTitleBar(registry);
	const Base = registry.get('office-ui-title-bar') as unknown as SharedTitleBarCtor;
	// The shared `state` setter takes the resolved model; the alias's own accessor shadows it.
	const setShared = Object.getOwnPropertyDescriptor(Base.prototype, 'state')!.set!;
	class PptxTitleBar extends Base {
		static autosaveEvent = 'toggle-autosave';
		static searchEvent = 'command-search';
		static switchTag = 'pptx-ui-switch';
		static searchTag = 'pptx-ui-search';
		#model: TitleBarViewState = EMPTY_STATE;
		constructor() {
			super();
			if (this.shadowRoot) {
				attachControlStyles(this.shadowRoot, bridgeCss('pptx-ui-title-bar'));
			}
			this.searchField.setAttribute('data-pptx-search-surface', '');
			this.searchField.setAttribute('data-pptx-search-input', '');
		}
		get state(): TitleBarViewState {
			return this.#model;
		}
		set state(value: TitleBarViewState | undefined) {
			this.#model = value ?? EMPTY_STATE;
			this.#sync();
		}
		override connectedCallback(): void {
			this.#sync();
		}
		override attributeChangedCallback(): void {
			this.#sync();
		}
		activate(id: string): void {
			const [name, detail] =
				id === 'save' || id === 'undo' || id === 'redo' ? [id, null] : ['quick-command', { id }];
			this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
		}
		rendered(): void {
			const below = this.placement === 'belowRibbon';
			// Stable hooks for tests and host CSS; the row is `[data-pptx-title-bar]`.
			this.toggleAttribute('data-pptx-title-bar', !below);
			if (below) {
				this.setAttribute('data-pptx-quick-access', 'below');
			} else {
				this.removeAttribute('data-pptx-quick-access');
			}
		}
		#sync(): void {
			setShared.call(this, officeTitleBarState(this.#model, this.placement));
		}
	}
	registry.define('pptx-ui-title-bar', PptxTitleBar);
}
