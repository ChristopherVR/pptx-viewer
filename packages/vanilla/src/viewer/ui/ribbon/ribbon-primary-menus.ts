import type { ToolbarActionId } from 'pptx-viewer-shared';
import { isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { RibbonHandlers } from './ribbon-types';

/** One entry in a primary-row popover menu (Present options / "..." overflow). */
export interface PrimaryMenuItem {
	label: string;
	run(): void;
	/** Draw a thin separator line above this entry. */
	separatorBefore?: boolean;
}

export interface PrimaryMenuHandle {
	el: HTMLElement;
	toggle(): void;
	close(): void;
	/** Reflect open state on an external trigger (adds `is-active`). */
	isOpen(): boolean;
}

/**
 * A right-aligned popover menu for the ribbon's quick-access row, closing on
 * selection or an outside pointerdown (same pattern as `makeDropdown`).
 */
export function makePrimaryMenu(
	doc: Document,
	ariaLabel: string,
	items: readonly PrimaryMenuItem[],
	onOpenChange?: (open: boolean) => void,
): PrimaryMenuHandle {
	const el = createEl(doc, 'div', 'pptxv-primary-menu');
	el.setAttribute('role', 'menu');
	el.setAttribute('aria-label', ariaLabel);
	el.hidden = true;

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		el.hidden = !next;
		onOpenChange?.(next);
	};

	for (const item of items) {
		if (item.separatorBefore) {
			el.appendChild(createEl(doc, 'div', 'pptxv-primary-menu-sep'));
		}
		const btn = createEl(doc, 'button', 'pptxv-primary-menu-item');
		btn.type = 'button';
		btn.setAttribute('role', 'menuitem');
		btn.textContent = item.label;
		btn.addEventListener('click', () => {
			setOpen(false);
			item.run();
		});
		el.appendChild(btn);
	}

	doc.addEventListener('pointerdown', (event) => {
		if (open && !el.parentElement?.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	return {
		el,
		toggle: () => setOpen(!open),
		close: () => setOpen(false),
		isOpen: () => open,
	};
}

/** The Present split-button dropdown entries (React's `PresentDropdown`). */
export function buildPresentMenuItems(
	t: Translator,
	handlers: RibbonHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): PrimaryMenuItem[] {
	const { slideShow } = handlers;
	const items: PrimaryMenuItem[] = [
		{ label: t('pptx.toolbar.present'), run: () => slideShow.startFromCurrent() },
		{ label: t('pptx.slideShow.presenterView'), run: () => slideShow.openPresenterView() },
		{ label: t('pptx.slideShow.rehearseTimings'), run: () => slideShow.startRehearsal() },
		{ label: t('pptx.slideShow.setUp'), run: () => slideShow.openSetUp(), separatorBefore: true },
	];
	if (!isActionHidden('broadcast', hiddenActions)) {
		items.push({ label: t('pptx.present.presentOnline'), run: () => slideShow.openBroadcast() });
	}
	items.push({ label: t('pptx.slideShow.subtitles'), run: () => slideShow.toggleSubtitles() });
	return items;
}

/** The "..." overflow entries (React's `OverflowMenu`), export items gated on `'export'`. */
export function buildOverflowMenuItems(
	t: Translator,
	handlers: RibbonHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): PrimaryMenuItem[] {
	const { file, nav } = handlers;
	const items: PrimaryMenuItem[] = [];
	if (!isActionHidden('export', hiddenActions)) {
		items.push(
			{ label: t('pptx.ribbon.exportPng'), run: () => file.exportPng() },
			{ label: t('pptx.ribbon.exportPdf'), run: () => file.exportPdf() },
			{ label: t('pptx.ribbon.exportVideo'), run: () => file.exportVideo() },
			{ label: t('pptx.ribbon.exportGif'), run: () => file.exportGif() },
			{ label: t('pptx.file.saveAsPptxTooltip'), run: () => file.save() },
			{ label: t('pptx.file.saveAsPpsxTooltip'), run: () => file.saveAsPpsx() },
			{ label: t('pptx.file.saveAsPptmTooltip'), run: () => file.saveAsPptm() },
		);
	}
	items.push(
		{ label: t('pptx.print.printButton'), run: () => file.print(), separatorBefore: true },
		{ label: t('pptx.file.copyImageTooltip'), run: () => file.copySlideAsImage() },
		{
			label: t('pptx.ribbon.accessibilityCheck'),
			run: () => nav.openAccessibility(),
			separatorBefore: true,
		},
		{ label: t('pptx.settings.keyboardShortcuts'), run: () => nav.openSettings('shortcuts') },
		{
			label: t('pptx.ribbon.versionHistory'),
			run: () => file.openVersionHistory(),
			separatorBefore: true,
		},
		{
			label: t('pptx.ribbon.documentProperties'),
			run: () => file.openDocumentProperties(),
			separatorBefore: true,
		},
		{ label: t('pptx.security.protectPresentation'), run: () => file.openPasswordProtection() },
		{ label: t('pptx.ribbon.embedFonts'), run: () => file.openFontEmbedding() },
		{ label: t('pptx.viewer.digitalSignatures'), run: () => file.openDigitalSignatures() },
	);
	return items;
}
