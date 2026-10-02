import { PRESENTER_CONSOLE_CONTROLS } from '../render';
import type { PresenterConsoleIntent, PresenterConsoleViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { createLucideIcon } from './lucide-icon';
import type { LucideIconName } from './lucide-icon';
import { PRESENTER_CONSOLE_STYLES } from './presenter-console-styles';

export type PresenterConsoleRequestEvent = CustomEvent<PresenterConsoleIntent>;
export interface PptxUiPresenterConsoleElement extends HTMLElement {
	state: PresenterConsoleViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-presenter-console': PptxUiPresenterConsoleElement;
	}
}

const identity = (key: string): string => key;

/**
 * The presenter console's control strip, rendered from the shared
 * `PRESENTER_CONSOLE_CONTROLS` inventory with its `data-pptx-presenter-control`
 * ids. `state.active` lists the toggles that read as on (which also swaps a
 * control's active icon and label) and `state.disabled` the inert ones; derive
 * both with `presenterConsoleViewState`. Each activation emits one bubbling,
 * composed `presenter-console-request` intent with the control id. The host
 * carries `data-pptx-presenter-toolbar` and `data-pptx-presenter-strip`.
 */
export function definePptxPresenterConsole(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-presenter-console')) {
		return;
	}
	class PresenterConsole extends HTMLElement implements PptxUiPresenterConsoleElement {
		private model: PresenterConsoleViewState = { active: [], disabled: [] };
		private readonly strip = this.ownerDocument.createElement('div');
		private readonly slots = PRESENTER_CONSOLE_CONTROLS.map((control) => {
			const doc = this.ownerDocument;
			if (control.kind === 'divider' || control.kind === 'spacer') {
				const node = doc.createElement('span');
				node.className = control.kind;
				node.dataset.pptxPresenterControl = control.id;
				return { control, node, icons: new Map<string, SVGSVGElement>() };
			}
			const node = doc.createElement('button');
			node.type = 'button';
			node.dataset.pptxPresenterControl = control.id;
			const icons = new Map<string, SVGSVGElement>();
			for (const name of [control.icon, control.activeIcon]) {
				if (name) {
					const icon = createLucideIcon(doc, name as LucideIconName);
					icons.set(name, icon);
				}
			}
			if (control.glyph) {
				node.append(control.glyph);
			}
			node.addEventListener('click', () =>
				this.dispatchEvent(
					new CustomEvent<PresenterConsoleIntent>('presenter-console-request', {
						detail: { id: control.id },
						bubbles: true,
						composed: true,
					}),
				),
			);
			return { control, node, icons };
		});
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, PRESENTER_CONSOLE_STYLES);
			this.strip.className = 'strip';
			this.strip.setAttribute('part', 'strip');
			this.strip.append(...this.slots.map((slot) => slot.node));
			root.append(this.strip);
		}
		get state() {
			return this.model;
		}
		set state(value: PresenterConsoleViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			this.render();
		}
		private render(): void {
			const s = this.model;
			const t = s.translate ?? identity;
			this.dataset.pptxPresenterToolbar = '';
			this.dataset.pptxPresenterStrip = '';
			for (const { control, node, icons } of this.slots) {
				if (control.kind === 'divider' || control.kind === 'spacer') {
					continue;
				}
				const button = node as HTMLButtonElement;
				const on = s.active.includes(control.id);
				const labelKey = on && control.activeLabelKey ? control.activeLabelKey : control.labelKey;
				const label = labelKey ? t(labelKey) : '';
				button.setAttribute('aria-label', label);
				button.title = label;
				button.disabled = s.disabled.includes(control.id);
				if (control.kind === 'toggle') {
					button.setAttribute('aria-pressed', String(on));
				}
				const icon = icons.get(
					(on && control.activeIcon ? control.activeIcon : control.icon) ?? '',
				);
				if (icon && button.firstElementChild !== icon) {
					button.replaceChildren(icon);
				}
			}
		}
	}
	registry.define('pptx-ui-presenter-console', PresenterConsole);
}
