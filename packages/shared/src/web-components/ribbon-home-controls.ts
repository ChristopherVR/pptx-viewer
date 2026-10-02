import { createRibbonControlIcon, homeControlKey, homeLabel } from '../render';
import type {
	RibbonHomeControlSpec,
	RibbonHomeIntent,
	RibbonHomeItem,
	RibbonHomeViewState,
} from '../render';
import { addButtonContent, makeHomeButton, syncHomeButton } from './ribbon-home-button';
import { paintHomeColour } from './ribbon-home-colour';
import { paintHomeLayouts } from './ribbon-home-layout';
import type { HomeLayoutArtwork } from './ribbon-home-layout';
import { paintHomeMenu } from './ribbon-home-menu';
import { createHomePopup } from './ribbon-home-popup';
import { popupSignature } from './ribbon-home-signature';

/** What a control builder needs from the element that hosts it. */
export interface HomeControlContext {
	doc: Document;
	request(intent: RibbonHomeIntent): void;
	popupChange(id: string, open: boolean): void;
	artwork(): HomeLayoutArtwork | undefined;
}

/** A built control: its node, the anchor hosts use, and how it reflects state. */
export interface HomeControl {
	node: HTMLElement;
	anchor: HTMLElement;
	buttons: Array<[string, HTMLElement]>;
	sync(state: RibbonHomeViewState): void;
}

/** A button that opens a popover (menu, colour or layout gallery) the element renders itself. */
export function buildPopupControl(
	ctx: HomeControlContext,
	control: RibbonHomeControlSpec,
): HomeControl {
	const { doc } = ctx;
	const slot = doc.createElement('div');
	slot.className = 'slot';
	slot.dataset.ribbonControl = control.id;
	const main = makeHomeButton(doc, control, (intent) =>
		control.caret ? ctx.request(intent) : popup.toggle(),
	);
	addButtonContent(doc, main, control);
	slot.append(main);
	const haspopup = control.kind === 'menu' ? 'menu' : 'dialog';
	let caret: HTMLButtonElement | undefined;
	if (control.caret) {
		slot.dataset.pptxChrome = 'split-button';
		main.dataset.pptxChrome ??= 'split-main';
		caret = makeHomeButton(doc, control, () => popup.toggle(), 'caret');
		caret.dataset.pptxChrome = 'split-caret';
		if (control.large) {
			caret.dataset.size = 'caret';
		}
		caret.append(createRibbonControlIcon(doc, 'home.slides.caret'));
		for (const [name, value] of Object.entries(control.caret.attrs ?? {})) {
			caret.setAttribute(name, value);
		}
		slot.append(caret);
	}
	const trigger = caret ?? main;
	trigger.setAttribute('aria-haspopup', haspopup);
	trigger.setAttribute('aria-expanded', 'false');
	let latest: RibbonHomeViewState = { controls: {} };
	let disposeArtwork: (() => void) | undefined;
	let painted = '';
	const key = homeControlKey(control);
	const popup = createHomePopup(
		doc,
		slot,
		trigger,
		haspopup,
		() => trigger.title,
		(open) => {
			if (open) {
				paint();
			} else {
				disposeArtwork?.();
				disposeArtwork = undefined;
			}
			ctx.popupChange(control.id, open);
		},
	);
	const choose = (value: string | number, ref?: RibbonHomeIntent['ref']) => {
		popup.close(popup.viaKeyboard);
		ctx.request(ref ? { id: control.id, value, ref } : { id: control.id, value });
	};
	function paint(): void {
		const current = latest.controls[key];
		painted = popupSignature(control, current, latest);
		disposeArtwork?.();
		disposeArtwork = undefined;
		if (control.kind === 'colour' && control.colour) {
			paintHomeColour(
				doc,
				popup.el,
				control.colour,
				current?.colour,
				current?.value,
				latest,
				(hex, ref) => choose(hex, ref),
			);
		} else if (control.kind === 'layout') {
			disposeArtwork = paintHomeLayouts(
				doc,
				popup.el,
				current?.layouts,
				latest,
				ctx.artwork(),
				(path) => choose(path),
			);
		} else {
			paintHomeMenu(
				doc,
				popup.el,
				current?.items ?? control.items ?? [],
				latest,
				current?.value,
				(value) => choose(value),
			);
		}
		popup.reposition();
	}
	const buttons: Array<[string, HTMLElement]> = [[key, main]];
	if (caret) {
		buttons.push([`${control.id}#caret`, caret]);
	}
	return {
		node: slot,
		anchor: slot,
		buttons,
		sync(state) {
			latest = state;
			const current = state.controls[key];
			syncHomeButton(main, control, state, current, { hideSelf: Boolean(caret) });
			if (caret) {
				syncHomeButton(caret, control, state, state.controls[`${control.id}#caret`], {
					caret: true,
				});
			} else {
				slot.hidden = Boolean(current?.hidden);
			}
			const triggerState = caret ? state.controls[`${control.id}#caret`] : current;
			if (triggerState?.disabled || triggerState?.hidden || current?.hidden) {
				popup.close();
			} else if (popup.isOpen && popupSignature(control, current, state) !== painted) {
				paint();
			}
		},
	};
}

function selectOptions(
	doc: Document,
	rows: readonly RibbonHomeItem[],
	state: RibbonHomeViewState,
): { nodes: HTMLElement[]; signature: string } {
	const nodes: HTMLElement[] = [];
	const signature: string[] = [];
	let group: HTMLOptGroupElement | undefined;
	for (const row of rows) {
		const option = doc.createElement('option');
		option.value = row.value;
		const label = row.label ?? homeLabel(state, row.labelKey ?? '', row.fallback ?? row.value);
		option.textContent = label;
		if (row.fontFamily) {
			option.style.fontFamily = row.fontFamily;
			option.dataset.displayLabel = label;
		}
		if (row.description) {
			option.dataset.description = row.description;
		}
		signature.push(`${row.group ?? ''}|${row.value}|${label}|${row.description ?? ''}`);
		if (row.group === undefined) {
			group = undefined;
			nodes.push(option);
			continue;
		}
		if (group?.label !== row.group) {
			group = doc.createElement('optgroup');
			group.label = row.group;
			nodes.push(group);
		}
		group.append(option);
	}
	return { nodes, signature: signature.join('\n') };
}

type SelectElement = HTMLElement & { value: string; disabled: boolean };

/** A field (family, size) or icon-only menu (spacing, direction, columns) on `pptx-ui-select`. */
export function buildSelectControl(
	ctx: HomeControlContext,
	control: RibbonHomeControlSpec,
): HomeControl {
	const { doc } = ctx;
	const select = doc.createElement('pptx-ui-select') as SelectElement;
	select.setAttribute('variant', control.select?.icon ? 'ribbon-icon' : 'ribbon-font');
	select.dataset.ribbonControl = control.id;
	if (control.select?.picker) {
		select.dataset.fontPicker = control.select.picker;
	}
	if (control.select?.icon) {
		const icon = createRibbonControlIcon(doc, control.id);
		icon.setAttribute('slot', 'icon');
		select.append(icon);
	}
	const key = homeControlKey(control);
	let signature = '';
	select.addEventListener('change', () => {
		ctx.request({ id: control.id, value: select.value });
	});
	return {
		node: select,
		anchor: select,
		buttons: [],
		sync(state) {
			const current = state.controls[key];
			const label = homeLabel(state, control.labelKey, control.fallback);
			// Re-writing an observed attribute makes the select repaint, which would swallow a click
			// on an open option, so only write what changed.
			if (select.getAttribute('aria-label') !== label) {
				select.setAttribute('aria-label', label);
			}
			select.title = label;
			select.hidden = Boolean(current?.hidden);
			const { nodes, signature: next } = selectOptions(
				doc,
				current?.items ?? control.items ?? [],
				state,
			);
			if (next !== signature) {
				signature = next;
				for (const child of [...select.children]) {
					if (child.getAttribute('slot') !== 'icon') {
						child.remove();
					}
				}
				select.append(...nodes);
			}
			if (current?.value !== undefined && select.getAttribute('value') !== String(current.value)) {
				select.value = String(current.value);
			}
			select.disabled = Boolean(current?.disabled);
		},
	};
}

/** A number spinner (the outline width). */
export function buildNumberControl(
	ctx: HomeControlContext,
	control: RibbonHomeControlSpec,
): HomeControl {
	const input = ctx.doc.createElement('input');
	input.type = 'number';
	input.className = 'num';
	input.dataset.ribbonControl = control.id;
	input.min = String(control.number?.min ?? 0);
	input.max = String(control.number?.max ?? 100);
	input.step = String(control.number?.step ?? 1);
	input.addEventListener('keydown', (event) => event.stopPropagation());
	input.addEventListener('change', () => {
		const next = input.valueAsNumber;
		if (Number.isFinite(next)) {
			ctx.request({ id: control.id, value: Math.max(control.number?.min ?? 0, next) });
		}
	});
	const key = homeControlKey(control);
	return {
		node: input,
		anchor: input,
		buttons: [],
		sync(state) {
			const current = state.controls[key];
			const label = homeLabel(state, control.labelKey, control.fallback);
			input.setAttribute('aria-label', label);
			input.title = label;
			input.disabled = Boolean(current?.disabled);
			input.hidden = Boolean(current?.hidden);
			if (typeof current?.value === 'number' && ctx.doc.activeElement !== input) {
				input.value = String(current.value);
			}
		},
	};
}
