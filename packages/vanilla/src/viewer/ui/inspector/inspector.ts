import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { createFillSection } from './fill-section';
import { createImageSection } from './image-section';
import { createPositionSection } from './position-section';
import { createSmartArtSection } from './smartart-section';
import { createTableSection } from './table-section';
import { createTextSection } from './text-section';
import type { Inspector, InspectorHandlers } from './types';

/**
 * The property inspector: a collapsible right-hand panel that shows different
 * controls depending on the selected element's `type`. Universal
 * position/size/rotation + flat fill/stroke/opacity/gradient sections apply
 * to every shape-like element; the Text, Image, and Table sections toggle
 * visibility based on the selected element's type discriminant. Vanilla
 * counterpart of the React/Vue/Angular per-element-type inspector panels
 * (`packages/react/src/viewer/components/inspector/`), scoped to the
 * highest-traffic panels. All labels from the shared `pptx.*` dictionary.
 */
export function createInspector(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): Inspector {
	const el = createEl(doc, 'aside', 'pptxv-inspector');
	el.setAttribute('aria-label', t('pptx.inspector.properties'));

	const header = createEl(doc, 'button', 'pptxv-inspector-header');
	header.type = 'button';
	header.setAttribute('aria-expanded', 'true');
	const title = createEl(doc, 'span', 'pptxv-inspector-title');
	title.textContent = t('pptx.inspector.properties');
	header.appendChild(title);
	const chevron = createEl(doc, 'span', 'pptxv-inspector-chevron');
	chevron.setAttribute('aria-hidden', 'true');
	chevron.textContent = '▾';
	header.appendChild(chevron);
	el.appendChild(header);

	const body = createEl(doc, 'div', 'pptxv-inspector-body');
	el.appendChild(body);

	const empty = createEl(doc, 'p', 'pptxv-inspector-empty');
	empty.textContent = t('pptx.inspector.element');
	body.appendChild(empty);

	const section = (label: string): HTMLElement => {
		const wrap = createEl(doc, 'div', 'pptxv-inspector-section');
		const caption = createEl(doc, 'h4', 'pptxv-inspector-section-title');
		caption.textContent = label;
		wrap.appendChild(caption);
		body.appendChild(wrap);
		return wrap;
	};

	const position = createPositionSection(doc, t, section, handlers.setGeometry);
	const fill = createFillSection(doc, t, section, handlers);
	const text = createTextSection(doc, t, section, handlers);
	const image = createImageSection(doc, t, section, handlers);
	const table = createTableSection(doc, t, section, handlers);
	const smartArt = createSmartArtSection(doc, t, section, handlers);
	const sections = [position, fill, text, image, table, smartArt];

	let expanded = true;
	const applyExpanded = (): void => {
		body.hidden = !expanded;
		header.setAttribute('aria-expanded', String(expanded));
		chevron.textContent = expanded ? '▾' : '▸';
	};
	header.addEventListener('click', () => {
		expanded = !expanded;
		applyExpanded();
	});

	return {
		el,
		update(state) {
			empty.hidden = state.hasSelection;
			for (const s of sections) {
				s.update(state);
			}
		},
		setEditable(editable) {
			el.hidden = !editable;
		},
	};
}
