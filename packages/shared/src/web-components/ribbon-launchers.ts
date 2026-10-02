/**
 * Office's dialog launcher: the small corner glyph at the bottom right of a group. The viewer has no
 * modal Font or Paragraph dialogs, so a host maps a group to the nearest real destination (the
 * Properties pane) and names it honestly in the tooltip.
 */
export interface RibbonLauncher {
	label: () => string;
	run: () => void;
}
export type RibbonLaunchers = Readonly<Record<string, RibbonLauncher>>;

export const LAUNCHER_CHROME = 'group-launcher';
const SELECTOR = `[data-pptx-chrome="${LAUNCHER_CHROME}"]`;
const GLYPH = 'M2 2h4M2 2v4M10 10 4 4M10 10H7M10 10V7';

function glyph(doc: Document): SVGSVGElement {
	const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 12 12');
	svg.setAttribute('aria-hidden', 'true');
	const path = doc.createElementNS(svg.namespaceURI, 'path');
	path.setAttribute('d', GLYPH);
	svg.append(path);
	return svg;
}

/** Give every launcher-bearing group its corner button (native shells) or `launcher` attribute. */
export function syncLaunchers(content: HTMLElement, launchers: RibbonLaunchers): void {
	for (const group of content.querySelectorAll<HTMLElement>('[data-ribbon-group]')) {
		const launcher = launchers[group.dataset.ribbonGroup ?? ''];
		if (!launcher || group.parentElement?.closest('[data-ribbon-group]')) {
			continue;
		}
		const label = launcher.label();
		if (group.localName === 'pptx-ui-ribbon-group') {
			group.setAttribute('launcher', '');
			group.setAttribute('launcher-label', label);
			continue;
		}
		let button = group.querySelector<HTMLButtonElement>(`:scope > ${SELECTOR}`);
		if (!button) {
			button = group.ownerDocument.createElement('button');
			button.type = 'button';
			button.dataset.pptxChrome = LAUNCHER_CHROME;
			button.append(glyph(group.ownerDocument));
			group.append(button);
		}
		button.title = label;
		button.setAttribute('aria-label', label);
	}
}

/** Route launcher presses from native buttons and from the shared group's event. */
export function listenForLaunchers(content: HTMLElement, launchers: RibbonLaunchers): () => void {
	const click = (event: Event) => {
		const button = (event.target as Element | null)?.closest?.(SELECTOR);
		const id = button?.closest<HTMLElement>('[data-ribbon-group]')?.dataset.ribbonGroup;
		if (id) {
			launchers[id]?.run();
		}
	};
	const shared = (event: Event) => {
		const id = (event as CustomEvent<{ id?: string }>).detail?.id;
		if (id) {
			launchers[id]?.run();
		}
	};
	content.addEventListener('click', click);
	content.addEventListener('launcher-request', shared);
	return () => {
		content.removeEventListener('click', click);
		content.removeEventListener('launcher-request', shared);
	};
}

/** Home groups whose Office launcher opens a formatting surface the viewer has as a pane. */
export const HOME_LAUNCHER_GROUPS = ['home.font', 'home.paragraph', 'home.drawing'] as const;

/** One launcher per Home formatting group, all opening the same pane. */
export function homeLaunchers(label: () => string, run: () => void): RibbonLaunchers {
	return Object.fromEntries(HOME_LAUNCHER_GROUPS.map((id) => [id, { label, run }]));
}
