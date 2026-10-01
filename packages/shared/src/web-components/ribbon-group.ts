import { attachControlStyles } from './control-styles';

const STYLES = `
:host { display: inline-flex; flex: none; align-self: stretch; }
.group { box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;
	min-height: 78px; padding: 4px 8px 2px; border-right: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent); }
:host(:last-child) .group { border-right: 0; }
.row { display: flex; align-items: flex-start; gap: 4px; }
/* One-line (compact) groups centre their commands on the whole group box; the caption
   stays in flow and the row's negative margin hands its height to the centring. */
:host([data-compact-row]) .row { flex: 1; align-items: center; margin-bottom: -14px; }
::slotted(*) { flex-shrink: 0; }
.caption { padding-top: 2px; color: var(--pptx-muted-foreground, #94a3b8); font: inherit;
	font-size: 9px; line-height: 12px; text-align: center; white-space: nowrap; }
`;

const COMPACT_ROW_MAX_HEIGHT = 36;

/** Slotted view boundary; customization ids remain in the light DOM. */
export function definePptxRibbonGroup(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-group')) {
		return;
	}
	class RibbonGroup extends HTMLElement {
		static observedAttributes = ['label'];
		private readonly caption: HTMLSpanElement;
		private observer: ResizeObserver | undefined;
		private readonly slotEl: HTMLSlotElement;
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, STYLES);
			const group = document.createElement('div');
			group.className = 'group';
			const row = document.createElement('div');
			row.className = 'row';
			const slot = document.createElement('slot');
			this.slotEl = slot;
			slot.addEventListener('slotchange', () => this.observe(slot));
			row.append(slot);
			this.caption = document.createElement('span');
			this.caption.className = 'caption';
			group.append(row, this.caption);
			root.append(group);
		}
		connectedCallback(): void {
			this.setAttribute('role', 'group');
			this.sync();
			this.observe(this.slotEl);
		}
		disconnectedCallback(): void {
			this.observer?.disconnect();
		}
		private observe(slot: HTMLSlotElement): void {
			this.observer?.disconnect();
			if (typeof ResizeObserver !== 'undefined') {
				this.observer ??= new ResizeObserver(() => this.measure());
			}
			for (const el of slot.assignedElements()) {
				this.observer?.observe(el);
			}
			this.measure();
		}
		/** Marks groups whose commands are all single-line so they can be centred vertically. */
		private measure(): void {
			const heights = [...this.children].map((el) => el.getBoundingClientRect().height);
			const tallest = Math.max(0, ...heights);
			if (tallest > 0) {
				this.toggleAttribute('data-compact-row', tallest <= COMPACT_ROW_MAX_HEIGHT);
			}
		}
		attributeChangedCallback(): void {
			this.sync();
		}
		private sync(): void {
			const label = this.getAttribute('label') ?? '';
			this.caption.textContent = label;
			this.setAttribute('aria-label', label);
		}
	}
	registry.define('pptx-ui-ribbon-group', RibbonGroup);
}
