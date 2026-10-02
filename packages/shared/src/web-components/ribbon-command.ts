import { RIBBON_MENU_COMMAND_IDS } from '../render';
import type { RibbonControlId } from '../render';
import { attachControlStyles } from './control-styles';
import { RIBBON_COMMAND_STYLES } from './ribbon-command-styles';
import { RIBBON_ICON_PATHS } from './ribbon-icons';

export type RibbonCommandRequestEvent = CustomEvent<{ id: RibbonControlId }>;

/** Stateless command button. Pointer, Enter and Space emit one host-owned intent. */
export function definePptxRibbonCommand(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-command')) {
		return;
	}
	class RibbonCommand extends HTMLElement {
		static observedAttributes = [
			'label',
			'icon',
			'disabled',
			'active',
			'compact',
			'pressed',
			'expanded',
			'title',
			'data-ribbon-control',
			'badge',
			'icon-only',
			'caret',
			'tall',
		];
		private readonly button: HTMLButtonElement;
		private readonly text: HTMLSpanElement;
		private readonly path: SVGPathElement;
		private readonly badge: HTMLSpanElement;
		private readonly caret: SVGSVGElement;
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, RIBBON_COMMAND_STYLES);
			this.button = document.createElement('button');
			this.button.type = 'button';
			this.button.setAttribute('part', 'button');
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 20 20');
			svg.setAttribute('aria-hidden', 'true');
			this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			svg.append(this.path);
			this.text = document.createElement('span');
			this.caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			this.caret.setAttribute('viewBox', '0 0 20 20');
			this.caret.setAttribute('aria-hidden', 'true');
			this.caret.setAttribute('class', 'caret');
			const caretPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			caretPath.setAttribute('d', 'M5 7.5 10 12.5 15 7.5');
			this.caret.append(caretPath);
			this.button.append(svg, this.text);
			this.badge = document.createElement('span');
			this.badge.className = 'badge';
			this.badge.setAttribute('aria-hidden', 'true');
			this.button.append(this.badge);
			root.append(this.button);
			this.button.addEventListener('keydown', (event) => {
				// Keep native activation out of the viewer's slide-navigation handlers.
				if (
					(event.key === ' ' || event.key === 'Enter') &&
					!event.ctrlKey &&
					!event.metaKey &&
					!event.altKey
				) {
					event.stopPropagation();
				}
			});
			this.button.addEventListener('click', () => {
				const id = this.getAttribute('data-ribbon-control');
				if (!this.button.disabled && id) {
					this.dispatchEvent(
						new CustomEvent('command-request', { detail: { id }, bubbles: true, composed: true }),
					);
				}
			});
		}
		connectedCallback(): void {
			this.sync();
		}
		attributeChangedCallback(): void {
			this.sync();
		}
		private sync(): void {
			this.text.textContent = this.getAttribute('label') ?? '';
			const label = this.text.textContent;
			// The chevron trails the last line of the label, as PowerPoint draws it.
			this.text.append(this.caret);
			this.text.hidden = this.hasAttribute('icon-only');
			if (this.text.hidden) {
				this.button.setAttribute('aria-label', label);
			} else {
				this.button.removeAttribute('aria-label');
			}
			const menu = RIBBON_MENU_COMMAND_IDS.has(this.getAttribute('data-ribbon-control') ?? '');
			this.caret.toggleAttribute(
				'hidden',
				this.getAttribute('caret') === 'false' || !(menu || this.hasAttribute('caret')),
			);
			this.badge.textContent = this.getAttribute('badge') ?? '';
			this.badge.hidden = !this.badge.textContent;
			this.button.title = this.getAttribute('title') ?? label;
			this.button.disabled = this.hasAttribute('disabled');
			this.path.setAttribute('d', RIBBON_ICON_PATHS[this.getAttribute('icon') ?? ''] ?? '');
			for (const attr of ['pressed', 'expanded']) {
				const value = this.getAttribute(attr);
				if (value === null) {
					this.button.removeAttribute(`aria-${attr}`);
				} else {
					this.button.setAttribute(`aria-${attr}`, value);
				}
			}
		}
	}
	registry.define('pptx-ui-ribbon-command', RibbonCommand);
}
