import { attachControlStyles } from './control-styles';
import { RIBBON_ICON_PATHS } from './ribbon-icons';

const STYLES = `
:host { display: inline-flex; flex: none; align-self: stretch; }
.group { position: relative; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;
	min-height: 84px; padding: 3px 6px 0; }
/* Office draws a hairline between groups that stops short of the group's top and bottom. */
.group::after { content: ''; position: absolute; top: 6px; bottom: 6px; right: 0; width: 1px;
	background: color-mix(in srgb, var(--pptx-border, #33334d) 80%, transparent); }
:host(:last-child) .group::after { content: none; }
.row { display: flex; align-items: flex-start; gap: 2px; flex: 1; }
/* One-line (compact) groups centre their commands on the whole group box; the caption
   stays in flow and the row's negative margin hands its height to the centring. */
:host([data-compact-row]) .row { align-items: center; margin-bottom: -14px; }
/* Several small drop-down galleries or commands (Picture Format > Adjust, SmartArt > Create Graphic, Design > Variants) stack in columns of three, as PowerPoint draws them. */
:host([data-stack]) .row { flex-direction: column; align-items: stretch; align-content: flex-start; flex-wrap: wrap; max-height: 66px; gap: 2px; margin-bottom: 0; }
::slotted(*) { flex-shrink: 0; }
.foot { position: relative; display: flex; align-items: center; justify-content: center; min-height: 16px; padding: 0 14px; }
.caption { color: var(--pptx-muted-foreground, #94a3b8); font: inherit;
	font-size: 11px; line-height: 16px; text-align: center; white-space: nowrap; }
.launcher { position: absolute; right: -2px; bottom: 1px; display: none; width: 14px; height: 14px; padding: 0;
	align-items: center; justify-content: center; border: 0; border-radius: 2px; background: transparent;
	color: var(--pptx-muted-foreground, #94a3b8); cursor: pointer; }
:host([launcher]) .launcher { display: inline-flex; }
.launcher svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.launcher:hover { background: var(--pptx-accent, #33334d); color: var(--pptx-foreground, #f8fafc); }
.launcher:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 1px; }
/* Collapsed (narrow window): the group is one button; its commands open in a popup. */
.face { display: none; }
:host([data-collapsed]) .face { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2px;
	min-width: 56px; height: 66px; margin-top: 3px; padding: 3px 6px; border: 0; border-radius: 4px; background: transparent;
	color: var(--pptx-foreground, #f8fafc); font: inherit; font-size: 12px; line-height: 15px; cursor: pointer; }
:host([data-collapsed]) .face:hover, :host([data-open]) .face { background: var(--pptx-accent, #33334d); }
.face:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 2px; }
.face svg { width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; color: var(--pptx-primary, #6366f1); }
.face svg.chev { width: 9px; height: 9px; margin-top: -1px; stroke-width: 1.8; color: currentColor; }
:host([data-collapsed]) .foot { display: none; }
:host([data-collapsed]) .row { display: none; }
:host([data-collapsed][data-open]) .row { display: flex; flex-wrap: wrap; position: fixed; top: var(--pptx-collapse-y, 120px); left: var(--pptx-collapse-x, 8px);
	z-index: 1200; box-sizing: border-box; max-width: calc(100vw - 16px); padding: 8px; background: var(--pptx-popover, #111827); color: var(--pptx-popover-foreground, #f9fafb);
	border: 1px solid var(--pptx-border, #374151); border-radius: 6px; box-shadow: 0 8px 24px #0005; }
@media (forced-colors: active) { .group::after { background: ButtonText; } .launcher { color: ButtonText; } :host([data-collapsed][data-open]) .row { border-color: ButtonText; } }
`;

/** The Office dialog-launcher glyph: a corner bracket with an arrow into it. */
const LAUNCHER_PATH = 'M2 2h4M2 2v4M10 10 4 4M10 10H7M10 10V7';
const COMPACT_ROW_MAX_HEIGHT = 36;

/** Slotted view boundary; customization ids remain in the light DOM. */
export function definePptxRibbonGroup(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-group')) {
		return;
	}
	class RibbonGroup extends HTMLElement {
		static observedAttributes = ['label', 'launcher-label', 'data-ribbon-group', 'icon'];
		private readonly caption: HTMLSpanElement;
		private readonly launcherButton: HTMLButtonElement;
		private readonly face: HTMLButtonElement;
		private readonly facePath: SVGPathElement;
		private readonly faceLabel: HTMLSpanElement;
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
			const foot = document.createElement('div');
			foot.className = 'foot';
			this.launcherButton = document.createElement('button');
			this.launcherButton.type = 'button';
			this.launcherButton.className = 'launcher';
			this.launcherButton.dataset.pptxChrome = 'group-launcher';
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 12 12');
			svg.setAttribute('aria-hidden', 'true');
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', LAUNCHER_PATH);
			svg.append(path);
			this.launcherButton.append(svg);
			this.launcherButton.addEventListener('click', () => {
				this.dispatchEvent(
					new CustomEvent('launcher-request', {
						detail: { id: this.getAttribute('data-ribbon-group') },
						bubbles: true,
						composed: true,
					}),
				);
			});
			foot.append(this.caption, this.launcherButton);
			this.face = document.createElement('button');
			this.face.type = 'button';
			this.face.className = 'face';
			this.face.dataset.pptxChrome = 'ribbon-collapse';
			this.face.setAttribute('aria-haspopup', 'true');
			const faceSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			faceSvg.setAttribute('viewBox', '0 0 20 20');
			faceSvg.setAttribute('aria-hidden', 'true');
			this.facePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			faceSvg.append(this.facePath);
			this.faceLabel = document.createElement('span');
			const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			chevron.setAttribute('viewBox', '0 0 10 10');
			chevron.setAttribute('class', 'chev');
			chevron.setAttribute('aria-hidden', 'true');
			const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			chevronPath.setAttribute('d', 'm1.5 3.5 3.5 3.5 3.5-3.5');
			chevron.append(chevronPath);
			this.face.append(faceSvg, this.faceLabel, chevron);
			// The ribbon overflow controller listens for this and owns which popup is open.
			this.face.addEventListener('click', () =>
				this.dispatchEvent(
					new CustomEvent('ribbon-collapse-toggle', { bubbles: true, composed: true }),
				),
			);
			group.append(this.face, row, foot);
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
			// `slotchange` is asynchronous and can fire after the group was removed: observing then
			// would pin the detached subtree (a ResizeObserver holds its targets), so never re-arm.
			if (!this.isConnected) {
				return;
			}
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
			const stackable = [...this.children].filter((el) => {
				// Angular wraps each gallery in its own component host.
				const gallery =
					el.localName === 'pptx-ui-ribbon-gallery'
						? el
						: el.querySelector('pptx-ui-ribbon-gallery');
				return (
					gallery?.getAttribute('mode') === 'dropdown' &&
					!gallery.hasAttribute('data-command-large')
				);
			});
			this.toggleAttribute(
				'data-stack',
				stackable.length > 1 && stackable.length === this.children.length,
			);
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
			const launcherLabel = this.getAttribute('launcher-label') ?? `${label} options`;
			this.faceLabel.textContent = label;
			this.face.title = label;
			this.face.setAttribute('aria-label', label);
			this.face.setAttribute('aria-expanded', String(this.hasAttribute('data-open')));
			this.facePath.setAttribute(
				'd',
				RIBBON_ICON_PATHS[this.getAttribute('icon') ?? 'layers'] ?? '',
			);
			this.launcherButton.setAttribute('aria-label', launcherLabel);
			this.launcherButton.title = launcherLabel;
		}
	}
	registry.define('pptx-ui-ribbon-group', RibbonGroup);
}
