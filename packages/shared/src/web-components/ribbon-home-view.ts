import {
	RIBBON_HOME_FAMILIES,
	createRibbonControlIcon,
	homeControlKey,
	homeLabel,
} from '../render';
import type {
	RibbonHomeControlSpec,
	RibbonHomeControlState,
	RibbonHomeFamily,
	RibbonHomeIntent,
	RibbonHomeViewState,
} from '../render';

/** All Home button markup lives here; the host only reflects state and routes intents. */
export function createRibbonHomeView(
	doc: Document,
	family: RibbonHomeFamily,
	request: (intent: RibbonHomeIntent) => void,
) {
	const spec = RIBBON_HOME_FAMILIES[family];
	const root = doc.createElement('div');
	root.className = 'home';
	const buttons = new Map<string, HTMLButtonElement>();
	/** Elements the host anchors a native popover to (the control's wrapper or button). */
	const anchors = new Map<string, HTMLElement>();
	const labelled: Array<{ button: HTMLButtonElement; spec: RibbonHomeControlSpec }> = [];

	const makeButton = (control: RibbonHomeControlSpec, part?: string): HTMLButtonElement => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'b';
		if (control.testId) {
			button.dataset.testid = control.testId;
		}
		if (control.danger) {
			button.dataset.tone = 'danger';
		}
		// Keep the text selection and caret in the slide while a format is applied.
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('keydown', (event) => {
			// Native activation must not reach the viewer's slide shortcuts.
			if (event.key === ' ' || event.key === 'Enter') {
				event.stopPropagation();
			}
		});
		button.addEventListener('click', () => {
			if (!button.disabled) {
				const intent: RibbonHomeIntent = { id: control.id };
				if (part ?? control.part) {
					intent.part = part ?? control.part;
				}
				request(intent);
			}
		});
		return button;
	};

	const buildControl = (control: RibbonHomeControlSpec): HTMLElement => {
		const button = makeButton(control);
		if (control.icon !== false) {
			button.append(createRibbonControlIcon(doc, control.icon ?? control.id));
		}
		if (control.text) {
			const caption = doc.createElement('span');
			caption.className = 'text';
			button.append(caption);
		}
		buttons.set(homeControlKey(control), button);
		labelled.push({ button, spec: control });
		if (control.part) {
			button.dataset.part = control.part;
			return button;
		}
		if (!control.popup && !control.caret) {
			button.dataset.ribbonControl = control.id;
			anchors.set(control.id, button);
			return button;
		}
		const slot = doc.createElement('div');
		slot.className = 'slot';
		slot.dataset.ribbonControl = control.id;
		if (control.popup) {
			button.setAttribute('aria-haspopup', 'menu');
		}
		slot.append(button);
		if (control.caret) {
			slot.dataset.pptxChrome = 'split-button';
			button.dataset.pptxChrome = 'split-main';
			const caret = makeButton(control, 'caret');
			caret.dataset.pptxChrome = 'split-caret';
			caret.setAttribute('aria-haspopup', 'menu');
			caret.append(createRibbonControlIcon(doc, 'home.slides.caret'));
			buttons.set(`${control.id}#caret`, caret);
			slot.append(caret);
		}
		anchors.set(control.id, slot);
		return slot;
	};

	const clusters = spec.clusters.map((cluster) => {
		const strip = doc.createElement('div');
		strip.className = cluster.free ? 'free' : 'cluster';
		strip.dataset.pptxChrome = cluster.chrome ?? 'control-cluster';
		strip.append(...cluster.controls.map(buildControl));
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

	function applyState(
		button: HTMLButtonElement,
		current: RibbonHomeControlState | undefined,
		control: RibbonHomeControlSpec,
		isCaret: boolean,
	) {
		button.disabled = Boolean(current?.disabled);
		const slot = button.parentElement?.classList.contains('slot') ? button.parentElement : null;
		if (slot && !control.caret) {
			// A popup slot hides as a whole so a hidden control leaves no gap.
			slot.hidden = Boolean(current?.hidden);
		} else {
			button.hidden = Boolean(current?.hidden);
		}
		if (current?.pressed === undefined) {
			button.removeAttribute('aria-pressed');
			delete button.dataset.active;
		} else {
			button.setAttribute('aria-pressed', String(current.pressed));
			if (control.testId && !isCaret) {
				button.dataset.active = String(current.pressed);
			}
		}
		if (current?.expanded === undefined) {
			button.removeAttribute('aria-expanded');
		} else {
			button.setAttribute('aria-expanded', String(current.expanded));
		}
	}

	const sync = (state: RibbonHomeViewState) => {
		if (group && spec.group) {
			const label = homeLabel(state, spec.group.captionKey, spec.group.fallback);
			caption.textContent = label;
			group.setAttribute('aria-label', label);
		}
		for (const { button, spec: control } of labelled) {
			const label = homeLabel(state, control.labelKey, control.fallback);
			const visible = control.text
				? homeLabel(state, control.text.key, control.text.fallback)
				: undefined;
			button.title = label;
			button.setAttribute('aria-label', visible ?? label);
			const textEl = button.querySelector('.text');
			if (textEl && visible !== undefined) {
				textEl.textContent = visible;
			}
			applyState(button, state.controls[homeControlKey(control)], control, false);
			const caret = control.caret ? buttons.get(`${control.id}#caret`) : undefined;
			if (caret && control.caret) {
				const name = homeLabel(state, control.caret.labelKey, control.caret.fallback);
				caret.title = name;
				caret.setAttribute('aria-label', name);
				applyState(caret, state.controls[`${control.id}#caret`], control, true);
			}
		}
	};

	const anchor = (id: string): HTMLElement | undefined => anchors.get(id);
	return { root, sync, buttons, anchor };
}
