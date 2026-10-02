import { RIBBON_CONTROL_ICONS, createRibbonControlIcon } from '../render';
import { RIBBON_ICON_PATHS } from './ribbon-icons';
import { listenForLaunchers, syncLaunchers } from './ribbon-launchers';
import type { RibbonLaunchers } from './ribbon-launchers';

/**
 * Office collapses a ribbon group into one button when the window is too narrow for it:
 * the group keeps its icon and caption, and its commands open in a popup. This controller does
 * the same for any ribbon content row in any binding. It only reads and writes attributes
 * (`data-collapsed`, `data-open`) and one injected face button, so framework-owned markup is
 * never replaced; `ribbon-collapse-css` and `ribbon-group` draw the collapsed look.
 */

export const COLLAPSE_FACE = 'ribbon-collapse';
const FACE_SELECTOR = `[data-pptx-chrome="${COLLAPSE_FACE}"]`;
const DESKTOP_MIN_WIDTH = 768;

/** Control artwork (24px grid) that stands for each Home group when it is collapsed. */
const CONTROL_FACE: Readonly<Record<string, string>> = {
	'home.clipboard': 'home.clipboard.paste',
	'home.slides': 'home.slides.newSlide',
	'home.font': 'home.font.bold',
	'home.paragraph': 'home.paragraph.alignLeft',
	'home.editing': 'home.editing.find',
	'home.drawing': 'home.drawing.shapes',
	'home.arrange': 'home.drawing.arrange',
};
/** Shared 20px artwork for the other tabs' groups. */
const PATH_FACE: Readonly<Record<string, string>> = {
	'insert.tables': 'table',
	'insert.images': 'image',
	'insert.illustrations': 'shapes',
	'insert.links': 'link',
	'insert.text': 'textBox',
	'insert.symbols': 'equation',
	'insert.media': 'video',
	'draw.tools': 'pencil',
	'design.themes': 'palette',
	'design.variants': 'palette',
	'design.customize': 'paint',
};

const isGroup = (el: Element): el is HTMLElement => el instanceof HTMLElement;
/** Tabs that collapse today; the other tabs keep scrolling until their own parity pass. */
const COLLAPSING_GROUPS = /^(home|insert|draw|design)\./u;

/** Group elements a row owns: outermost only, and only those that take part in layout. */
function groupsOf(content: HTMLElement): HTMLElement[] {
	return [...content.querySelectorAll<HTMLElement>('[data-ribbon-group]')].filter(
		(el) =>
			isGroup(el) &&
			COLLAPSING_GROUPS.test(el.dataset.ribbonGroup ?? '') &&
			el.getBoundingClientRect().width > 0 &&
			el.parentElement?.closest('[data-ribbon-group]') === null,
	);
}

function captionOf(group: HTMLElement): string {
	return (
		group.getAttribute('label') ??
		group.querySelector(':scope > [data-pptx-chrome="ribbon-group-label"]')?.textContent ??
		group.getAttribute('aria-label') ??
		''
	).trim();
}

function faceIcon(doc: Document, id: string): SVGSVGElement {
	const control = CONTROL_FACE[id];
	if (control && RIBBON_CONTROL_ICONS[control]) {
		return createRibbonControlIcon(doc, control);
	}
	const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 20 20');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	const path = doc.createElementNS(svg.namespaceURI, 'path');
	path.setAttribute('d', RIBBON_ICON_PATHS[PATH_FACE[id] ?? 'layers'] ?? '');
	svg.append(path);
	return svg;
}

/** Place a group's popup under its face, kept inside the viewport. */
export function placeCollapsedGroup(group: HTMLElement, face: HTMLElement): void {
	const rect = face.getBoundingClientRect();
	const width = group.ownerDocument.defaultView?.innerWidth ?? 1024;
	group.style.setProperty('--pptx-collapse-y', `${Math.round(rect.bottom + 2)}px`);
	group.style.setProperty(
		'--pptx-collapse-x',
		`${Math.round(Math.max(4, Math.min(rect.left, width - 360)))}px`,
	);
}

function ensureFace(group: HTMLElement): void {
	const id = group.dataset.ribbonGroup ?? '';
	if (group.localName === 'pptx-ui-ribbon-group') {
		// The shared group draws its own face in its shadow root.
		if (!group.hasAttribute('icon')) {
			group.setAttribute('icon', PATH_FACE[id] ?? 'layers');
		}
		return;
	}
	const caption = captionOf(group);
	let face = group.querySelector<HTMLElement>(`:scope > ${FACE_SELECTOR}`);
	if (!face) {
		const doc = group.ownerDocument;
		face = doc.createElement('button');
		face.setAttribute('type', 'button');
		face.dataset.pptxChrome = COLLAPSE_FACE;
		face.setAttribute('aria-haspopup', 'true');
		const label = doc.createElement('span');
		label.className = 'label';
		const chevron = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
		chevron.setAttribute('viewBox', '0 0 10 10');
		chevron.setAttribute('class', 'chev');
		chevron.setAttribute('aria-hidden', 'true');
		const path = doc.createElementNS(chevron.namespaceURI, 'path');
		path.setAttribute('d', 'm1.5 3.5 3.5 3.5 3.5-3.5');
		chevron.append(path);
		face.append(faceIcon(doc, id), label, chevron);
		group.prepend(face);
	}
	face.querySelector('.label')!.textContent = caption;
	face.setAttribute('aria-label', caption);
	face.title = caption;
	face.setAttribute('aria-expanded', String(group.hasAttribute('data-open')));
}

function closeAll(content: HTMLElement): void {
	for (const open of content.querySelectorAll<HTMLElement>('[data-ribbon-group][data-open]')) {
		open.removeAttribute('data-open');
		open.querySelector(`:scope > ${FACE_SELECTOR}`)?.setAttribute('aria-expanded', 'false');
	}
}

/** Collapse groups from the right until the row fits. Returns the groups left collapsed. */
export function reflowRibbon(content: HTMLElement): string[] {
	const doc = content.ownerDocument;
	closeAll(content);
	for (const collapsed of content.querySelectorAll('[data-ribbon-group][data-collapsed]')) {
		collapsed.removeAttribute('data-collapsed');
	}
	if ((doc.defaultView?.innerWidth ?? DESKTOP_MIN_WIDTH) < DESKTOP_MIN_WIDTH) {
		return [];
	}
	const overflows = () => content.scrollWidth - content.clientWidth > 1;
	const collapsed: string[] = [];
	if (!overflows()) {
		return collapsed;
	}
	for (const group of groupsOf(content).reverse()) {
		ensureFace(group);
		group.setAttribute('data-collapsed', '');
		collapsed.push(group.dataset.ribbonGroup ?? '');
		if (!overflows()) {
			break;
		}
	}
	return collapsed;
}

export interface RibbonRowOptions {
	/** Corner dialog-launcher buttons, keyed by group id. */
	launchers?: RibbonLaunchers;
}

/** Keep `content` collapsing as its width, tab and children change. Returns a disposer. */
export function attachRibbonOverflow(
	content: HTMLElement,
	options: RibbonRowOptions = {},
): () => void {
	const doc = content.ownerDocument;
	const view = doc.defaultView;
	let frame = 0;
	let forced = false;
	let lastWidth = -1;
	/** `force`: the set of groups changed (a tab switch), so even an open popup must be rebuilt. */
	const schedule = (force = false) => {
		forced ||= force;
		if (frame || !view) {
			return;
		}
		frame = view.requestAnimationFrame(() => {
			frame = 0;
			const rebuild = forced;
			forced = false;
			// An open popup survives incidental relayout; only a width change or new groups close it.
			if (
				!rebuild &&
				lastWidth === content.clientWidth &&
				content.querySelector('[data-ribbon-group][data-open]')
			) {
				return;
			}
			observer?.disconnect();
			lastWidth = content.clientWidth;
			reflowRibbon(content);
			if (options.launchers) {
				syncLaunchers(content, options.launchers);
			}
			observer?.observe(content, { childList: true, subtree: true });
		});
	};
	/** Menus rendered inside an open popup must not close it; only added or removed groups matter. */
	const touchesGroup = (record: MutationRecord) =>
		[...record.addedNodes, ...record.removedNodes].some(
			(node) =>
				node instanceof Element &&
				(node.matches('[data-ribbon-group]') || node.querySelector('[data-ribbon-group]') !== null),
		);
	const observer =
		typeof MutationObserver === 'undefined'
			? undefined
			: new MutationObserver((records) => schedule(records.some(touchesGroup)));
	const resize =
		typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => schedule());
	observer?.observe(content, { childList: true, subtree: true });
	resize?.observe(content);
	const onWindowResize = () => schedule();
	view?.addEventListener('resize', onWindowResize);

	const toggleGroup = (group: HTMLElement, face: HTMLElement | null) => {
		if (!face || !content.contains(group) || !group.hasAttribute('data-collapsed')) {
			return;
		}
		const open = !group.hasAttribute('data-open');
		closeAll(content);
		if (open) {
			group.setAttribute('data-open', '');
			placeCollapsedGroup(group, face);
			face.setAttribute('aria-expanded', 'true');
		}
	};
	const toggle = (event: Event) => {
		const face = (event.target as Element | null)?.closest?.<HTMLElement>(FACE_SELECTOR) ?? null;
		const group = face?.closest<HTMLElement>('[data-ribbon-group]');
		if (face && group) {
			toggleGroup(group, face);
		}
	};
	/** The shared group draws its face in its own shadow root and reports the press. */
	const toggleShared = (event: Event) => {
		const group = (event.target as Element | null)?.closest?.<HTMLElement>('[data-ribbon-group]');
		if (group) {
			toggleGroup(group, group.shadowRoot?.querySelector<HTMLElement>('.face') ?? null);
		}
	};
	const outside = (event: Event) => {
		const open = content.querySelector<HTMLElement>('[data-ribbon-group][data-open]');
		if (open && !event.composedPath().includes(open)) {
			closeAll(content);
		}
	};
	const escape = (event: KeyboardEvent) => {
		const open = content.querySelector<HTMLElement>('[data-ribbon-group][data-open]');
		if (event.key === 'Escape' && open) {
			event.stopPropagation();
			closeAll(content);
			(open.querySelector<HTMLElement>(FACE_SELECTOR) ?? open).focus();
		}
	};
	/** A command ends the popup; a control that opens its own menu keeps it. */
	const afterCommand = (event: Event) => {
		const open = content.querySelector<HTMLElement>('[data-ribbon-group][data-open]');
		const button = (event.composedPath()[0] as Element | undefined)?.closest?.('button');
		if (
			open?.contains(button ?? null) &&
			button &&
			!button.matches(`${FACE_SELECTOR}, [aria-haspopup], [aria-expanded]`)
		) {
			closeAll(content);
		}
	};
	content.addEventListener('click', toggle);
	content.addEventListener('ribbon-collapse-toggle', toggleShared);
	content.addEventListener('click', afterCommand);
	content.addEventListener('keydown', escape);
	doc.addEventListener('pointerdown', outside, true);
	const stopLaunchers = options.launchers
		? listenForLaunchers(content, options.launchers)
		: undefined;
	schedule(true);

	return () => {
		stopLaunchers?.();
		observer?.disconnect();
		resize?.disconnect();
		view?.removeEventListener('resize', onWindowResize);
		view?.cancelAnimationFrame(frame);
		content.removeEventListener('click', toggle);
		content.removeEventListener('ribbon-collapse-toggle', toggleShared);
		content.removeEventListener('click', afterCommand);
		content.removeEventListener('keydown', escape);
		doc.removeEventListener('pointerdown', outside, true);
		closeAll(content);
		for (const collapsed of content.querySelectorAll('[data-ribbon-group][data-collapsed]')) {
			collapsed.removeAttribute('data-collapsed');
		}
	};
}
