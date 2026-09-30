import { armEditorKeyboard, buildRibbonGallery } from 'pptx-viewer-shared';
import type { RibbonGalleryPickEvent, RibbonGalleryPlacement } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import type { RibbonGalleryHub, RibbonGalleryView } from './gallery-hub';

export interface RibbonGalleryOptions {
	chevronOnly?: boolean;
}
export interface RibbonGalleryControl extends RibbonGalleryView {
	el: HTMLElement;
	trigger: HTMLButtonElement;
	popup: HTMLElement;
	isOpen(): boolean;
}
/** View/CSS and popup lifecycle are shared; the hub retains native mutation/history. */
export function createRibbonGallery(
	doc: Document,
	t: Translator,
	placement: RibbonGalleryPlacement,
	hub: RibbonGalleryHub,
	options: RibbonGalleryOptions = {},
): RibbonGalleryControl {
	const el = doc.createElement('pptx-ui-ribbon-gallery');
	el.setAttribute('mode', placement.mode);
	el.toggleAttribute('chevron-only', Boolean(options.chevronOnly));
	if (!options.chevronOnly) {
		el.setAttribute('data-ribbon-control', placement.control);
	}
	el.translateLabel = (key, params) => t(key, params ? { ...params } : undefined);
	el.addEventListener('gallery-pick', (event) => {
		if (!el.disabled) {
			hub.pick(placement.gallery, (event as RibbonGalleryPickEvent).detail.itemId);
			armEditorKeyboard(el.closest<HTMLElement>('.pptxv'));
		}
	});
	const control: RibbonGalleryControl = {
		el,
		trigger: el.trigger,
		popup: el.popup,
		isOpen: () => el.open,
		close: () => el.close(),
		refresh(ctx, editable) {
			el.descriptor = buildRibbonGallery(placement.gallery, ctx);
			el.disabled = !editable;
		},
	};
	hub.register(control);
	return control;
}
