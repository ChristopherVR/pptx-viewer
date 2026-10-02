import { homeControlKey } from '../render';
import type { RibbonHomeControlSpec, RibbonHomeViewState } from '../render';
import type { PptxUiRibbonGalleryElement, RibbonGalleryPickEvent } from './ribbon-gallery';
import { addButtonContent, makeHomeButton, syncHomeButton } from './ribbon-home-button';
import type { HomeControl, HomeControlContext } from './ribbon-home-controls';

function galleryElement(
	ctx: HomeControlContext,
	control: RibbonHomeControlSpec,
	chevronOnly: boolean,
): PptxUiRibbonGalleryElement {
	const gallery = ctx.doc.createElement('pptx-ui-ribbon-gallery') as PptxUiRibbonGalleryElement;
	gallery.setAttribute('mode', 'dropdown');
	if (chevronOnly) {
		gallery.setAttribute('chevron-only', '');
	} else {
		gallery.setAttribute('icon', control.gallery?.icon ?? 'palette');
		gallery.setAttribute('data-ribbon-control', control.id);
	}
	gallery.addEventListener('gallery-pick', (event) => {
		event.stopPropagation();
		ctx.request({ id: control.id, value: (event as RibbonGalleryPickEvent).detail.itemId });
	});
	return gallery;
}

function syncGallery(
	gallery: PptxUiRibbonGalleryElement,
	control: RibbonHomeControlSpec,
	state: RibbonHomeViewState,
): void {
	const current = state.controls[homeControlKey(control)];
	const translate = state.translate;
	gallery.translateLabel = (key, params) => {
		const value = translate?.(key) ?? key;
		return params
			? value.replace(/\{\{\s*(\w+)\s*\}\}/gu, (_, name: string) => String(params[name] ?? ''))
			: value;
	};
	gallery.descriptor = current?.gallery?.descriptor;
	gallery.disabled = Boolean(current?.disabled) || Boolean(current?.gallery?.disabled);
}

/** A Quick Styles or Shape Effects trigger: the shared gallery element is the whole control. */
export function buildGalleryControl(
	ctx: HomeControlContext,
	control: RibbonHomeControlSpec,
): HomeControl {
	const gallery = galleryElement(ctx, control, false);
	return {
		node: gallery,
		anchor: gallery,
		buttons: [],
		sync(state) {
			syncGallery(gallery, control, state);
			gallery.hidden = Boolean(state.controls[homeControlKey(control)]?.hidden);
		},
	};
}

/** A toggle button followed by its chevron-only library gallery (Bullets, Numbering). */
export function buildListToggleControl(
	ctx: HomeControlContext,
	control: RibbonHomeControlSpec,
): HomeControl {
	const { doc } = ctx;
	const slot = doc.createElement('div');
	slot.className = 'slot';
	slot.dataset.ribbonControl = control.id;
	const button = makeHomeButton(doc, control, ctx.request);
	addButtonContent(doc, button, control);
	const gallery = galleryElement(ctx, control, true);
	slot.append(button, gallery);
	const key = homeControlKey(control);
	return {
		node: slot,
		anchor: slot,
		buttons: [[key, button]],
		sync(state) {
			const current = state.controls[key];
			syncHomeButton(button, control, state, current, { hideSelf: true });
			slot.hidden = Boolean(current?.hidden);
			syncGallery(gallery, control, state);
		},
	};
}
