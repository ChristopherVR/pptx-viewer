import { createRibbonControlIcon, homeLabel } from '../render';
import type {
	RibbonHomeControlSpec,
	RibbonHomeControlState,
	RibbonHomeIntent,
	RibbonHomeViewState,
} from '../render';

/** One command button; `part` names which button of a shared id it is. */
export function makeHomeButton(
	doc: Document,
	control: RibbonHomeControlSpec,
	request: (intent: RibbonHomeIntent) => void,
	part?: string,
): HTMLButtonElement {
	const button = doc.createElement('button');
	button.type = 'button';
	button.className = 'b';
	if (control.testId && !part) {
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
}

export function addButtonContent(
	doc: Document,
	button: HTMLButtonElement,
	control: RibbonHomeControlSpec,
): void {
	if (control.icon !== false) {
		button.append(createRibbonControlIcon(doc, control.icon ?? control.id));
	}
	if (control.text) {
		const caption = doc.createElement('span');
		caption.className = 'text';
		button.append(caption);
	}
	if (control.colour?.bar) {
		const bar = doc.createElement('span');
		bar.className = 'bar';
		button.append(bar);
	}
	if (control.chevron) {
		const chevron = createRibbonControlIcon(doc, 'home.slides.caret');
		chevron.classList.add('chev');
		button.append(chevron);
	}
	for (const [name, value] of Object.entries(control.attrs ?? {})) {
		button.setAttribute(name, value);
	}
}

/** Name, tooltip, visible caption and gating of one button. */
export function syncHomeButton(
	button: HTMLButtonElement,
	control: RibbonHomeControlSpec,
	state: RibbonHomeViewState,
	current: RibbonHomeControlState | undefined,
	options: { caret?: boolean; hideSelf?: boolean } = {},
): void {
	const spec = options.caret && control.caret ? control.caret : control;
	const label = homeLabel(state, spec.labelKey, spec.fallback);
	const visible =
		!options.caret && control.text
			? homeLabel(state, control.text.key, control.text.fallback)
			: undefined;
	const hint =
		current?.disabled && control.hintKey && !options.caret
			? homeLabel(state, control.hintKey, label)
			: label;
	button.title = hint;
	button.setAttribute('aria-label', visible ?? label);
	const textEl = button.querySelector('.text');
	if (textEl && visible !== undefined) {
		textEl.textContent = visible;
	}
	button.disabled = Boolean(current?.disabled);
	if (options.hideSelf !== false) {
		button.hidden = Boolean(current?.hidden);
	}
	if (current?.pressed === undefined) {
		button.removeAttribute('aria-pressed');
		delete button.dataset.active;
	} else {
		button.setAttribute('aria-pressed', String(current.pressed));
		if (control.testId && !options.caret) {
			button.dataset.active = String(current.pressed);
		}
	}
	const bar = button.querySelector<HTMLElement>('.bar');
	if (bar) {
		bar.style.backgroundColor = typeof current?.value === 'string' ? current.value : '';
	}
}
