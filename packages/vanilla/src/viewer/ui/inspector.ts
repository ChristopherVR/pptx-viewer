import type { GeometryPatch } from '../editor/editor-edit-ops';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { ColorControlHandle, NumberFieldHandle } from './controls';
import { makeColorControl, makeNumberField } from './controls';

/** The inspector edit actions (geometry + shape fill/stroke). */
export interface InspectorHandlers {
	setGeometry(patch: GeometryPatch): void;
	setShapeFill(color: string): void;
	setShapeStroke(color: string): void;
	setShapeStrokeWidth(width: number): void;
}

/** Selection-derived state the inspector reflects. */
export interface InspectorState {
	hasSelection: boolean;
	canShape: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	fillColor: string | undefined;
	strokeColor: string | undefined;
	strokeWidth: number;
}

export interface Inspector {
	el: HTMLElement;
	update(state: InspectorState): void;
	setEditable(editable: boolean): void;
}

/**
 * The property inspector: a collapsible right-hand panel with numeric
 * position/size/rotation fields (two-way: typing commits through history;
 * selection + drag reseeds the fields) plus fill / outline colour and outline
 * width for shape-like elements. Vanilla counterpart of the React/Vue "Arrange"
 * (Position & Size) + "Fill & Line" inspector sections; all labels from the
 * shared `pptx.arrange.*` / `pptx.inspector.*` dictionary.
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

	// -- Position & Size --------------------------------------------------------
	const posSection = section(t('pptx.arrange.positionSize'));
	const grid = createEl(doc, 'div', 'pptxv-inspector-grid');
	posSection.appendChild(grid);
	const geo = (label: string, key: keyof GeometryPatch, min?: number): NumberFieldHandle => {
		const field = makeNumberField(doc, {
			label,
			min,
			onCommit: (value) => handlers.setGeometry({ [key]: value }),
		});
		grid.appendChild(field.el);
		return field;
	};
	const xField = geo(t('pptx.arrange.x'), 'x');
	const yField = geo(t('pptx.arrange.y'), 'y');
	const wField = geo(t('pptx.arrange.width'), 'width', 1);
	const hField = geo(t('pptx.arrange.height'), 'height', 1);
	const rotField = geo(t('pptx.arrange.rotation'), 'rotation');

	// -- Fill & Line ------------------------------------------------------------
	const fillSection = section(t('pptx.shape.fillStroke'));
	const fillRow = createEl(doc, 'div', 'pptxv-inspector-row');
	const fill = makeColorControl(
		doc,
		{ label: t('pptx.inspector.fill'), onInput: handlers.setShapeFill },
		'#4f86ff',
	);
	const stroke = makeColorControl(
		doc,
		{ label: t('pptx.inspector.line'), onInput: handlers.setShapeStroke },
		'#1e3a8a',
	);
	const fillLabel = createEl(doc, 'span', 'pptxv-inspector-row-label');
	fillLabel.textContent = t('pptx.inspector.fill');
	const lineLabel = createEl(doc, 'span', 'pptxv-inspector-row-label');
	lineLabel.textContent = t('pptx.inspector.line');
	fillRow.append(fillLabel, fill.el, lineLabel, stroke.el);
	fillSection.appendChild(fillRow);
	const strokeWidth = makeNumberField(doc, {
		label: t('pptx.ribbon.strokeWidth'),
		min: 0,
		step: 0.5,
		onCommit: (value) => handlers.setShapeStrokeWidth(value),
	});
	fillSection.appendChild(strokeWidth.el);

	const geoFields: NumberFieldHandle[] = [xField, yField, wField, hField, rotField];
	const shapeControls: Array<ColorControlHandle | NumberFieldHandle> = [fill, stroke, strokeWidth];

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
			posSection.hidden = !state.hasSelection;
			fillSection.hidden = !state.hasSelection || !state.canShape;
			xField.setValue(state.x);
			yField.setValue(state.y);
			wField.setValue(state.width);
			hField.setValue(state.height);
			rotField.setValue(state.rotation);
			fill.setValue(state.fillColor);
			stroke.setValue(state.strokeColor);
			strokeWidth.setValue(state.strokeWidth);
			for (const f of geoFields) {
				f.setDisabled(!state.hasSelection);
			}
			for (const c of shapeControls) {
				c.setDisabled(!state.canShape);
			}
		},
		setEditable(editable) {
			el.hidden = !editable;
		},
	};
}
