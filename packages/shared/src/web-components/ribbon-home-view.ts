import { RIBBON_HOME_FAMILIES, homeControlKey, homeLabel } from '../render';
import type {
	RibbonHomeControlSpec,
	RibbonHomeFamily,
	RibbonHomeIntent,
	RibbonHomeViewState,
} from '../render';
import { addButtonContent, makeHomeButton, syncHomeButton } from './ribbon-home-button';
import { buildNumberControl, buildPopupControl, buildSelectControl } from './ribbon-home-controls';
import type { HomeControl, HomeControlContext } from './ribbon-home-controls';
import { buildGalleryControl, buildListToggleControl } from './ribbon-home-gallery';
import type { HomeLayoutArtwork } from './ribbon-home-layout';

/** A plain command button (or one button of a shared id, like an Align edge). */
function buildButtonControl(ctx: HomeControlContext, control: RibbonHomeControlSpec): HomeControl {
	const button = makeHomeButton(ctx.doc, control, ctx.request);
	addButtonContent(ctx.doc, button, control);
	if (control.part) {
		button.dataset.part = control.part;
	} else {
		button.dataset.ribbonControl = control.id;
	}
	const key = homeControlKey(control);
	return {
		node: button,
		anchor: button,
		buttons: [[key, button]],
		sync: (state) => syncHomeButton(button, control, state, state.controls[key]),
	};
}

function buildControl(ctx: HomeControlContext, control: RibbonHomeControlSpec): HomeControl {
	switch (control.kind) {
		case 'select':
			return buildSelectControl(ctx, control);
		case 'number':
			return buildNumberControl(ctx, control);
		case 'gallery':
			return buildGalleryControl(ctx, control);
		case 'menu':
		case 'colour':
		case 'layout':
			return buildPopupControl(ctx, control);
		default:
			return control.gallery
				? buildListToggleControl(ctx, control)
				: buildButtonControl(ctx, control);
	}
}

/** All Home markup lives here; the host only reflects state and routes intents. */
export function createRibbonHomeView(
	doc: Document,
	family: RibbonHomeFamily,
	request: (intent: RibbonHomeIntent) => void,
	popupChange: (id: string, open: boolean) => void,
	artwork: () => HomeLayoutArtwork | undefined,
) {
	const spec = RIBBON_HOME_FAMILIES[family];
	const root = doc.createElement('div');
	root.className = 'home';
	if (spec.group) {
		root.dataset.grouped = '';
	}
	const buttons = new Map<string, HTMLElement>();
	/** Elements the host anchors to (the control's wrapper or button). */
	const anchors = new Map<string, HTMLElement>();
	const built: HomeControl[] = [];
	const ctx: HomeControlContext = { doc, request, popupChange, artwork };

	const clusters = spec.clusters.map((cluster) => {
		const strip = doc.createElement('div');
		strip.className = cluster.free ? 'free' : 'cluster';
		strip.dataset.pptxChrome = cluster.chrome ?? 'control-cluster';
		if (cluster.stack) {
			strip.dataset.stack = '';
		}
		for (const control of cluster.controls) {
			const item = buildControl(ctx, control);
			built.push(item);
			for (const [key, button] of item.buttons) {
				buttons.set(key, button);
			}
			if (!anchors.has(control.id)) {
				anchors.set(control.id, item.anchor);
			}
			strip.append(item.node);
		}
		return strip;
	});
	let content: HTMLElement[] = clusters;
	if (spec.wrapper) {
		const wrap = doc.createElement('span');
		wrap.className = 'wrap';
		wrap.dataset.ribbonControl = spec.wrapper.id;
		wrap.dataset.pptxChrome = spec.wrapper.chrome ?? 'control-wrapper';
		wrap.append(...clusters);
		anchors.set(spec.wrapper.id, wrap);
		content = [wrap];
	}
	const group = spec.group ? doc.createElement('div') : undefined;
	const caption = doc.createElement('span');
	if (group) {
		group.className = 'group';
		group.dataset.ribbonGroup = spec.group?.id;
		group.dataset.pptxChrome = 'home-group';
		group.setAttribute('role', 'group');
		const row = doc.createElement('div');
		row.className = 'row';
		if (spec.group?.rowChrome) {
			row.dataset.pptxChrome = spec.group.rowChrome;
		}
		row.append(...content);
		caption.className = 'caption';
		caption.dataset.pptxChrome = 'ribbon-group-label';
		group.append(row, caption);
		root.append(group);
	} else {
		root.append(...content);
	}

	const sync = (state: RibbonHomeViewState) => {
		if (group && spec.group) {
			const label = homeLabel(state, spec.group.captionKey, spec.group.fallback);
			caption.textContent = label;
			group.setAttribute('aria-label', label);
		}
		for (const item of built) {
			item.sync(state);
		}
	};

	const anchor = (id: string): HTMLElement | undefined => anchors.get(id);
	return { root, sync, buttons, anchor };
}
