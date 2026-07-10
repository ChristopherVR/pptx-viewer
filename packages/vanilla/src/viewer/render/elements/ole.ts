import type { OlePptxElement } from 'pptx-viewer-core';
import type { ResolvedOleType } from 'pptx-viewer-shared';
import {
	formatBytes,
	getContainerStyle,
	getOleAriaLabel,
	getOleBadgeLabel,
	getOleTypeColor,
	getOleTypeLabel,
	getPlaceholderStyle,
	isBrowserOpenableMime,
	openUrlInNewTab,
	resolveOleType,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderContext, ElementRenderer } from '../types';
import { buildOleIcon } from './ole-icons';

/**
 * Renderer for `ole` (embedded object) elements, vanilla port of Vue's
 * `OleRenderer.vue` (viewer subset):
 *
 * - Preview image (`previewImageData`) with a small type badge overlay when
 *   core decoded one.
 * - Otherwise a type-specific placeholder box (brand colour, icon, display
 *   name + type sublabel) via the shared OLE type-resolution helpers.
 * - When core recovered the embedded payload (`oleEmbeddedData`), an action
 *   bar exposes the same viewer-side affordances as Vue: a Download link, an
 *   Open-in-new-tab button for browser-renderable MIME types (shared
 *   `openUrlInNewTab` handles the data-URL to blob-URL conversion), and a
 *   compact size caption; the full info caption doubles as the tooltip.
 */
export const renderOleElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'ole') {
		return null;
	}
	const doc = context.document;
	const oleType = resolveOleType(element);
	const typeColor = getOleTypeColor(oleType);
	const typeLabel = getOleTypeLabel(oleType);

	const el = createEl(doc, 'div', 'pptxv-element pptxv-ole', getContainerStyle(element, zIndex));
	el.dataset.elementId = element.id;
	el.setAttribute('role', 'group');
	el.setAttribute('aria-label', getOleAriaLabel(element));
	el.title = infoLines(element, typeLabel).join('\n');

	if (element.previewImageData) {
		el.appendChild(buildPreview(doc, element, typeColor, getOleBadgeLabel(oleType)));
	} else {
		el.appendChild(buildPlaceholder(doc, element, oleType, typeColor, typeLabel));
	}

	if (element.oleEmbeddedData) {
		el.appendChild(buildActionBar(doc, element, typeLabel, context));
	}
	return el;
};

/** Info caption lines: type, name, size, producing application. */
function infoLines(el: OlePptxElement, typeLabel: string): string[] {
	const lines = [typeLabel];
	const name = el.oleEmbeddedFileName ?? el.fileName;
	if (name) {
		lines.push(name);
	}
	const size = formatBytes(el.oleEmbeddedByteSize);
	if (size) {
		lines.push(size);
	}
	if (el.oleProgId) {
		lines.push(el.oleProgId);
	}
	return lines;
}

/** Preview image with the small type badge overlay (bottom-right). */
function buildPreview(
	doc: Document,
	el: OlePptxElement,
	typeColor: string,
	badgeLabel: string,
): HTMLElement {
	const preview = createEl(doc, 'div', 'pptxv-ole-preview', {
		position: 'relative',
		width: '100%',
		height: '100%',
	});
	const img = createEl(doc, 'img', 'pptxv-ole-img', {
		width: '100%',
		height: '100%',
		objectFit: 'contain',
		pointerEvents: 'none',
		userSelect: 'none',
		display: 'block',
	});
	img.src = el.previewImageData ?? '';
	img.alt = getOleAriaLabel(el);
	img.draggable = false;
	preview.appendChild(img);

	const badge = createSvgEl(doc, 'svg', { width: 24, height: 24, viewBox: '0 0 24 24' });
	badge.setAttribute('class', 'pptxv-ole-badge');
	// Decorative overlay: never intercept clicks meant for the action bar.
	badge.setAttribute(
		'style',
		'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:none',
	);
	badge.appendChild(
		createSvgEl(doc, 'rect', { x: 2, y: 2, width: 20, height: 20, rx: 3, fill: typeColor }),
	);
	const badgeText = createSvgEl(doc, 'text', {
		x: 12,
		y: 16,
		'text-anchor': 'middle',
		fill: 'white',
		'font-size': badgeLabel.length > 4 ? 6 : 10,
		'font-weight': 'bold',
	});
	badgeText.textContent = badgeLabel;
	badge.appendChild(badgeText);
	preview.appendChild(badge);
	return preview;
}

/** Type-specific placeholder box: icon + display name + type sublabel. */
function buildPlaceholder(
	doc: Document,
	el: OlePptxElement,
	oleType: ResolvedOleType,
	typeColor: string,
	typeLabel: string,
): HTMLElement {
	const box = createEl(doc, 'div', 'pptxv-ole-placeholder', {
		...getPlaceholderStyle(oleType),
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		pointerEvents: 'none',
		boxSizing: 'border-box',
	});
	box.appendChild(buildOleIcon(doc, oleType, typeColor));

	const name = createEl(doc, 'span', 'pptxv-ole-name', {
		marginTop: '8px',
		fontSize: '12px',
		fontWeight: 500,
		maxWidth: '90%',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		color: typeColor,
	});
	name.textContent = el.oleEmbeddedFileName ?? el.fileName ?? typeLabel;
	box.appendChild(name);

	if (el.fileName) {
		const sublabel = createEl(doc, 'span', 'pptxv-ole-sublabel', {
			marginTop: '2px',
			fontSize: '10px',
			color: 'rgba(0,0,0,0.45)',
			maxWidth: '90%',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
		});
		sublabel.textContent = typeLabel;
		box.appendChild(sublabel);
	}
	return box;
}

const ACTION_STYLE = {
	flex: 'none',
	padding: '2px 8px',
	border: '1px solid rgba(0,0,0,0.18)',
	borderRadius: '4px',
	background: '#fff',
	color: '#1a1a1a',
	font: 'inherit',
	fontSize: '11px',
	lineHeight: 1.4,
	cursor: 'pointer',
	textDecoration: 'none',
} as const;

/** Download / Open action bar for the recovered embedded payload. */
function buildActionBar(
	doc: Document,
	el: OlePptxElement,
	typeLabel: string,
	context: ElementRenderContext,
): HTMLElement {
	const data = el.oleEmbeddedData ?? '';
	const downloadName = el.oleEmbeddedFileName ?? el.fileName ?? typeLabel;

	const bar = createEl(doc, 'div', 'pptxv-ole-actions', {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: '6px',
		padding: '4px 6px',
		boxSizing: 'border-box',
		background: 'rgba(255,255,255,0.82)',
		borderTop: '1px solid rgba(0,0,0,0.08)',
		fontSize: '11px',
		pointerEvents: 'auto',
	});
	// Swallow pointer interactions so a click on an action never bubbles into
	// host-level element selection / drag handlers.
	for (const type of ['pointerdown', 'mousedown', 'click'] as const) {
		bar.addEventListener(type, (event) => event.stopPropagation());
	}

	const size = formatBytes(el.oleEmbeddedByteSize);
	if (size) {
		const meta = createEl(doc, 'span', 'pptxv-ole-meta', {
			marginRight: 'auto',
			color: 'rgba(0,0,0,0.55)',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
		});
		meta.textContent = size;
		bar.appendChild(meta);
	}

	const download = createEl(doc, 'a', 'pptxv-ole-action', ACTION_STYLE);
	download.href = data;
	download.download = downloadName;
	const downloadTitle = context.t('pptx.ole.downloadName', { name: downloadName });
	download.setAttribute('aria-label', downloadTitle);
	download.title = downloadTitle;
	download.textContent = context.t('pptx.ole.download');
	bar.appendChild(download);

	if (isBrowserOpenableMime(el.oleEmbeddedMimeType)) {
		const open = createEl(doc, 'button', 'pptxv-ole-action', ACTION_STYLE);
		open.type = 'button';
		const openTitle = context.t('pptx.ole.openName', { name: downloadName });
		open.setAttribute('aria-label', openTitle);
		open.title = openTitle;
		open.textContent = context.t('pptx.ole.open');
		open.addEventListener('click', () => openUrlInNewTab(data));
		bar.appendChild(open);
	}
	return bar;
}
