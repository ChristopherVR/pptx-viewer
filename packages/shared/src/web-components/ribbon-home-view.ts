import { RIBBON_HOME_FAMILIES, createRibbonControlIcon, homeLabel } from '../render';
import type { RibbonHomeFamily, RibbonHomeIntent, RibbonHomeViewState } from '../render';

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
	const clusters = spec.clusters.map((cluster) => {
		const strip = doc.createElement('div');
		strip.className = 'cluster';
		strip.dataset.pptxChrome = 'control-cluster';
		for (const control of cluster) {
			const button = doc.createElement('button');
			button.type = 'button';
			button.dataset.ribbonControl = control.id;
			if (control.testId) {
				button.dataset.testid = control.testId;
			}
			button.append(createRibbonControlIcon(doc, control.id));
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
					request({ id: control.id });
				}
			});
			buttons.set(control.id, button);
			strip.append(button);
		}
		return strip;
	});
	const group = spec.group ? doc.createElement('div') : undefined;
	const caption = doc.createElement('span');
	if (group) {
		group.className = 'group';
		group.dataset.ribbonGroup = spec.group?.id;
		group.dataset.pptxChrome = 'home-group';
		group.setAttribute('role', 'group');
		const row = doc.createElement('div');
		row.className = 'row';
		row.append(...clusters);
		caption.className = 'caption';
		caption.dataset.pptxChrome = 'ribbon-group-label';
		group.append(row, caption);
		root.append(group);
	} else {
		root.append(...clusters);
	}
	const sync = (state: RibbonHomeViewState) => {
		if (group && spec.group) {
			const label = homeLabel(state, spec.group.captionKey, spec.group.fallback);
			caption.textContent = label;
			group.setAttribute('aria-label', label);
		}
		for (const control of spec.clusters.flat()) {
			const button = buttons.get(control.id);
			if (!button) {
				continue;
			}
			const current = state.controls[control.id];
			const label = homeLabel(state, control.labelKey, control.fallback);
			button.title = label;
			button.setAttribute('aria-label', label);
			button.disabled = Boolean(current?.disabled);
			button.hidden = Boolean(current?.hidden);
			if (current?.pressed === undefined) {
				button.removeAttribute('aria-pressed');
				delete button.dataset.active;
			} else {
				button.setAttribute('aria-pressed', String(current.pressed));
				if (control.testId) {
					button.dataset.active = String(current.pressed);
				}
			}
		}
	};
	return { root, sync, buttons };
}
