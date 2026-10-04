import {
	defineButton,
	defineCheckbox,
	defineContextMenu,
	defineDialogFooter,
	definePasteOptions,
	defineRadio,
	defineRibbonGroup,
	defineReadOnlyBanner,
	defineRibbonToggle,
	defineSearchField,
	defineSelect,
	defineSwitch,
	defineToasts,
} from 'ooxml-ui/controls';
import { getIcon, registerIcon } from 'ooxml-ui/icons';

import {
	COMPAT_TOAST_VISIBLE_LIMIT,
	compatToastStackStyle,
	PASTE_SPECIAL_OPTIONS,
	RIBBON_MENU_COMMAND_IDS,
} from '../render';
import type {
	CompatToastsViewState,
	DialogFooterViewState,
	PasteOptionsViewState,
	ReadOnlyBannerViewState,
} from '../render';
import { attachControlStyles } from './control-styles';
import { bridgeCss } from './office-token-bridge';
import type { OFFICE_ALIAS_TAGS } from './office-token-bridge';
import { RIBBON_ICON_PATHS } from './ribbon-icons';

/**
 * The `pptx-ui-*` tags of controls that moved to `ooxml-ui` (`office-ui-*`). Each tag is a thin
 * subclass of the shared element, registered under the published pptx name so bindings, tests
 * and hosts keep the same attributes, properties, events and test ids. Differences are translated
 * here, never in callers: event names and test ids through the shared elements' static fields,
 * i18n keys and positioning through the `state` setter. See `docs/ooxml-ui-plan.md` in ooxml.
 */

type Ctor = CustomElementConstructor;
/** The shared elements expose `state` as an accessor the aliases override. */
interface Stateful extends HTMLElement {
	get state(): unknown;
	set state(value: unknown);
}
type Translate = (key: string, params?: Record<string, string>) => string;
const identity: Translate = (key) => key;

function base(
	registry: CustomElementRegistry,
	define: (r: CustomElementRegistry) => void,
	tag: string,
): Ctor {
	define(registry);
	return registry.get(tag)!;
}

/** A subclass of the shared element carrying the pptx token bridge in its own shadow root. */
function bridged(Base: Ctor, tag: (typeof OFFICE_ALIAS_TAGS)[number]): Ctor {
	return class extends Base {
		constructor() {
			super();
			if (this.shadowRoot) {
				attachControlStyles(this.shadowRoot, bridgeCss(tag));
			}
		}
	};
}

/** Plain aliases: same contract, new implementation. */
export function definePptxCheckbox(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-checkbox')) {
		return;
	}
	registry.define(
		'pptx-ui-checkbox',
		class extends bridged(
			base(registry, defineCheckbox, 'office-ui-checkbox'),
			'pptx-ui-checkbox',
		) {},
	);
}
export function definePptxSwitch(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-switch')) {
		return;
	}
	registry.define(
		'pptx-ui-switch',
		class extends bridged(base(registry, defineSwitch, 'office-ui-switch'), 'pptx-ui-switch') {},
	);
}
export function definePptxRadio(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-radio')) {
		return;
	}
	registry.define(
		'pptx-ui-radio',
		class extends bridged(base(registry, defineRadio, 'office-ui-radio'), 'pptx-ui-radio') {},
	);
}
export function definePptxSearchField(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-search')) {
		return;
	}
	registry.define(
		'pptx-ui-search',
		class extends bridged(
			base(registry, defineSearchField, 'office-ui-search'),
			'pptx-ui-search',
		) {},
	);
}

/** Same contract: `<option>`/`<optgroup>` children, the ribbon variants and font pickers. */
export function definePptxSelect(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-select')) {
		return;
	}
	registry.define(
		'pptx-ui-select',
		class extends bridged(base(registry, defineSelect, 'office-ui-select'), 'pptx-ui-select') {},
	);
}

/** `data-ribbon-control` and `toggle-request { id, checked }` stay the published contract. */
export function definePptxRibbonToggle(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-toggle')) {
		return;
	}
	// The shared row draws a pptx-ui-checkbox in its shadow root, as it always did.
	definePptxCheckbox(registry);
	const Base = bridged(
		base(registry, defineRibbonToggle, 'office-ui-ribbon-toggle'),
		'pptx-ui-ribbon-toggle',
	);
	registry.define(
		'pptx-ui-ribbon-toggle',
		class extends Base {
			static requestEvent = 'toggle-request';
			static idAttribute = 'data-ribbon-control';
			static detailKey = 'id';
			static checkboxTag = 'pptx-ui-checkbox';
		},
	);
}

/** The pptx icon names map onto the shared glyphs (`pen` is `pencil` there). */
const FOOTER_ICONS: Readonly<Record<string, string>> = { pen: 'pencil' };

export function definePptxDialogFooter(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-dialog-footer')) {
		return;
	}
	const Base = bridged(
		base(registry, defineDialogFooter, 'office-ui-dialog-footer'),
		'pptx-ui-dialog-footer',
	) as unknown as new () => Stateful;
	class PptxDialogFooter extends Base {
		static requestEvent = 'dialog-footer-request';
		static testIdPrefix = 'pptx-dialog-footer';
		#model: DialogFooterViewState = { actions: [] };
		override get state(): DialogFooterViewState {
			return this.#model;
		}
		override set state(value: DialogFooterViewState) {
			this.#model = value;
			super.state = {
				actions: value.actions.map((action) =>
					action.icon ? { ...action, icon: FOOTER_ICONS[action.icon] ?? action.icon } : action,
				),
			};
		}
	}
	registry.define('pptx-ui-dialog-footer', PptxDialogFooter as unknown as Ctor);
}

export function definePptxCompatToasts(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-compat-toasts')) {
		return;
	}
	const Base = bridged(
		base(registry, defineToasts, 'office-ui-toasts'),
		'pptx-ui-compat-toasts',
	) as unknown as new () => Stateful;
	class PptxCompatToasts extends Base {
		static requestEvent = 'compat-toasts-request';
		static testIdPrefix = 'pptx-compat-toast';
		#model: CompatToastsViewState = { toasts: [] };
		override get state(): CompatToastsViewState {
			return this.#model;
		}
		override set state(value: CompatToastsViewState) {
			this.#model = value;
			// Positioned against the viewer root, clear of the docked panel and notes strip.
			for (const [name, css] of Object.entries(
				compatToastStackStyle(value.rightInset ?? 0, value.bottomInset ?? 0),
			)) {
				this.style.setProperty(
					name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
					css,
				);
			}
			const t = value.translate ?? identity;
			super.state = {
				toasts: value.toasts.slice(0, COMPAT_TOAST_VISIBLE_LIMIT).map((toast) => ({
					id: toast.id,
					code: toast.code,
					severity: toast.severity,
					message: t(toast.messageKey, toast.params),
				})),
				overflowCount:
					(value.overflowCount ?? 0) +
					Math.max(0, value.toasts.length - COMPAT_TOAST_VISIBLE_LIMIT),
				labels: {
					title: t('pptx.compatibility.toastTitle'),
					dismissAll: t('pptx.compatibility.dismissAll'),
					dismiss: t('pptx.compatibility.dismiss'),
				},
			};
		}
	}
	registry.define('pptx-ui-compat-toasts', PptxCompatToasts as unknown as Ctor);
}

export function definePptxReadOnlyBanner(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-read-only-banner')) {
		return;
	}
	const Base = bridged(
		base(registry, defineReadOnlyBanner, 'office-ui-read-only-banner'),
		'pptx-ui-read-only-banner',
	) as unknown as new () => Stateful;
	class PptxReadOnlyBanner extends Base {
		static requestEvent = 'read-only-request';
		static testIdPrefix = 'pptx-readonly';
		#model: ReadOnlyBannerViewState = { kind: null, messageKey: '' };
		override get state(): ReadOnlyBannerViewState {
			return this.#model;
		}
		override set state(value: ReadOnlyBannerViewState) {
			this.#model = value;
			const t = value.translate ?? identity;
			const error = value.passwordError ?? null;
			super.state = {
				kind: value.kind,
				message: value.messageKey ? t(value.messageKey) : '',
				...(value.passwordPromptOpen !== undefined
					? { passwordPromptOpen: value.passwordPromptOpen }
					: {}),
				passwordError: error
					? t(
							error === 'wrong-password'
								? 'pptx.readOnly.wrongPassword'
								: 'pptx.readOnly.unsupportedAlgorithm',
						)
					: null,
				...(value.checkingPassword !== undefined
					? { checkingPassword: value.checkingPassword }
					: {}),
				labels: {
					title: t('pptx.readOnly.bannerTitle'),
					editAnyway: t('pptx.readOnly.editAnyway'),
					dismiss: t('pptx.readOnly.dismiss'),
					passwordLabel: t('pptx.readOnly.passwordLabel'),
					passwordPlaceholder: t('pptx.readOnly.passwordPlaceholder'),
					unlock: t('pptx.readOnly.unlock'),
					cancel: t('pptx.common.cancel'),
				},
			};
		}
	}
	registry.define('pptx-ui-read-only-banner', PptxReadOnlyBanner as unknown as Ctor);
}

export function definePptxPasteOptions(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-paste-options')) {
		return;
	}
	const Base = bridged(
		base(registry, definePasteOptions, 'office-ui-paste-options'),
		'pptx-ui-paste-options',
	) as unknown as new () => Stateful;
	class PptxPasteOptions extends Base {
		static requestEvent = 'paste-options-request';
		static dismissEvent = 'paste-options-dismiss';
		static testIdPrefix = 'pptx-paste-options';
		#model: PasteOptionsViewState = { left: 0, top: 0 };
		connectedCallback(): void {
			// Hosts find the strip by this hook; attributes cannot be set in a constructor.
			this.dataset.pptxPasteOptions = '';
			(Base.prototype as { connectedCallback?: () => void }).connectedCallback?.call(this);
			// Connecting re-renders the shared position; keep the published pixel contract.
			this.placeInPixels();
		}
		/** The published contract positions the strip in pixels, 4px from the pasted corner. */
		private placeInPixels(): void {
			this.style.left = `${this.#model.left + 4}px`;
			this.style.top = `${this.#model.top + 4}px`;
		}
		override get state(): PasteOptionsViewState {
			return this.#model;
		}
		override set state(value: PasteOptionsViewState) {
			this.#model = value;
			this.dataset.pptxPasteOptions = '';
			const t = value.translate ?? identity;
			super.state = {
				left: value.left,
				top: value.top,
				label: t('pptx.pasteSpecial.optionsLabel'),
				options: PASTE_SPECIAL_OPTIONS.map((option) => ({
					id: option.id,
					label: t(option.labelKey),
				})),
			};
			this.placeInPixels();
		}
	}
	registry.define('pptx-ui-paste-options', PptxPasteOptions as unknown as Ctor);
}

/** pptx glyphs live under a `pptx:` prefix in the shared icon registry, so they never collide. */
function registerPptxIcons(): void {
	for (const [name, d] of Object.entries(RIBBON_ICON_PATHS)) {
		if (!getIcon(`pptx:${name}`)) {
			registerIcon(`pptx:${name}`, d);
		}
	}
}

/**
 * `pptx-ui-ribbon-command`: `data-ribbon-control` and `command-request { id }` stay the published
 * contract; `compact` maps onto the shared small size and the default onto the large one; the
 * menu chevron follows `RIBBON_MENU_COMMAND_IDS` unless `caret` says otherwise.
 */
export function definePptxRibbonCommand(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-command')) {
		return;
	}
	registerPptxIcons();
	const Base = bridged(
		base(registry, defineButton, 'office-ui-button'),
		'pptx-ui-ribbon-command',
	) as unknown as {
		new (): HTMLElement & {
			attributeChangedCallback?(name: string, old: string | null, value: string | null): void;
		};
		observedAttributes: string[];
	};
	class PptxRibbonCommand extends Base {
		static requestEvent = 'command-request';
		static idAttribute = 'data-ribbon-control';
		static detailKey = 'id';
		static override get observedAttributes(): string[] {
			return [...super.observedAttributes, 'compact'];
		}
		connectedCallback(): void {
			this.syncSize();
			(Base.prototype as { connectedCallback?: () => void }).connectedCallback?.call(this);
		}
		override attributeChangedCallback(
			name: string,
			old: string | null,
			value: string | null,
		): void {
			if (name === 'compact' || name === 'icon-only') {
				this.syncSize();
			}
			super.attributeChangedCallback?.(name, old, value);
		}
		protected iconName(): string | null {
			const icon = this.getAttribute('icon');
			return icon ? `pptx:${icon}` : null;
		}
		/** pptx shows the label as the tooltip even when it is visible. */
		protected tooltip(label: string): string {
			return this.getAttribute('title') ?? label;
		}
		protected showsCaret(): boolean {
			const caret = this.getAttribute('caret');
			if (caret === 'false') {
				return false;
			}
			return (
				caret !== null ||
				RIBBON_MENU_COMMAND_IDS.has(this.getAttribute('data-ribbon-control') ?? '')
			);
		}
		private syncSize(): void {
			if (!this.isConnected) {
				return;
			}
			const size = this.hasAttribute('icon-only')
				? null
				: this.hasAttribute('compact')
					? 'small'
					: 'large';
			if (size === null) {
				this.removeAttribute('size');
			} else if (this.getAttribute('size') !== size) {
				this.setAttribute('size', size);
			}
		}
	}
	registry.define('pptx-ui-ribbon-command', PptxRibbonCommand as unknown as Ctor);
}

/**
 * `pptx-ui-ribbon-group`: `launcher-request { id }` (the `data-ribbon-group` id) and
 * `ribbon-collapse-toggle` stay the published events; the `data-pptx-chrome` hooks stay.
 */
export function definePptxRibbonGroup(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-group')) {
		return;
	}
	registerPptxIcons();
	const Base = bridged(
		base(registry, defineRibbonGroup, 'office-ui-ribbon-group'),
		'pptx-ui-ribbon-group',
	) as unknown as new () => HTMLElement;
	class PptxRibbonGroup extends Base {
		static launcherEvent = 'launcher-request';
		static collapseEvent = 'ribbon-collapse-toggle';
		connectedCallback(): void {
			const root = this.shadowRoot!;
			const launcher = root.querySelector<HTMLElement>('.launcher');
			if (launcher) {
				launcher.dataset.pptxChrome = 'group-launcher';
			}
			const face = root.querySelector<HTMLElement>('.face');
			if (face) {
				face.dataset.pptxChrome = 'ribbon-collapse';
			}
			(Base.prototype as { connectedCallback?: () => void }).connectedCallback?.call(this);
		}
		protected launcherDetail(): Record<string, unknown> {
			return { id: this.getAttribute('data-ribbon-group') };
		}
		protected iconName(): string {
			return `pptx:${this.getAttribute('icon') ?? 'layers'}`;
		}
	}
	registry.define('pptx-ui-ribbon-group', PptxRibbonGroup as unknown as Ctor);
}

/**
 * `pptx-ui-context-menu`: the shared menu's controlled mode with `menu-request` and `menu-close`,
 * and markers limited to the `data-pptx-*` namespace.
 */
export function definePptxContextMenu(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-context-menu')) {
		return;
	}
	const Base = bridged(
		base(registry, defineContextMenu, 'office-ui-context-menu'),
		'pptx-ui-context-menu',
	);
	registry.define(
		'pptx-ui-context-menu',
		class extends Base {
			static requestEvent = 'menu-request';
			static closeEvent = 'menu-close';
			static markerPattern = /^data-pptx-[a-z0-9-]+$/;
		},
	);
}
