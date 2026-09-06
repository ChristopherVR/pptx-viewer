/**
 * chart-user-shape-section.ts: "Chart overlay shapes" section (`c:userShapes`
 * drawing overlay), mirroring React's `inspector/ChartUserShapeOptions.tsx`.
 *
 * Lists a chart's overlay shapes as a flat, indented tree: a top-level shape
 * plus, for a `grpSp` group, every shape grouped inside it (arbitrarily
 * nested), each as its own row (W2-F). Add a default text box, delete any
 * row, and edit a `sp`/`cxnSp` row's text/fill/line, a `pic` row's alt text,
 * and any non-group row's position/size. All decision logic (the row list,
 * the default shape, the array edits) lives in `pptx-viewer-shared`'s
 * `chart-user-shape-edit`/`chart-user-shape-tree` modules; this file only
 * maps it onto plain DOM controls (CLAUDE.md Rule 2).
 */
import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import {
	createDefaultChartUserShape,
	createDefaultChartUserShapeGroupChild,
	getChartUserShapeGroupTransform,
	listChartUserShapeRows,
	withChartUserShapeAdded,
	withChartUserShapeGroupChildAdded,
	withChartUserShapeRowChartBoxUpdated,
	withChartUserShapeRowFlipUpdated,
	withChartUserShapeRowRemoved,
	withChartUserShapeRowRotationUpdated,
	withChartUserShapeRowTextUpdated,
	withChartUserShapeRowUpdated,
} from 'pptx-viewer-shared';
import type { ChartUserShapeRow } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { buildPositionControls } from './chart-user-shape-position-controls';
import { colorInput, labeledField, textInput } from './chart-user-shape-row-controls';

export interface ChartUserShapeSection {
	el: HTMLElement;
	update(data: PptxChartData): void;
}

type RowPatch = Partial<PptxChartUserShape>;

export function createChartUserShapeSection(
	doc: Document,
	t: Translator,
	onChange: (data: PptxChartData) => void,
): ChartUserShapeSection {
	const el = doc.createElement('div');
	el.className = 'pptxv-chart-usershapes';

	const heading = doc.createElement('h5');
	heading.textContent = t('pptx.chart.userShapes');
	const addButton = doc.createElement('button');
	addButton.type = 'button';
	addButton.dataset.testid = 'chart-user-shape-add';
	addButton.textContent = t('pptx.chart.userShapeAddTextBox');
	const header = doc.createElement('div');
	header.className = 'pptxv-chart-usershapes-header';
	header.append(heading, addButton);

	const empty = doc.createElement('p');
	empty.className = 'pptxv-chart-usershapes-empty';
	empty.textContent = t('pptx.chart.userShapesEmpty');

	const list = doc.createElement('div');
	list.className = 'pptxv-chart-usershapes-list';

	el.append(header, empty, list);

	let current: PptxChartData | undefined;

	addButton.addEventListener('click', () => {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeAdded(current.userShapes, createDefaultChartUserShape()),
		} as PptxChartData);
	});

	function patchRow(path: readonly number[], patch: RowPatch): void {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeRowUpdated(current.userShapes, path, patch),
		} as PptxChartData);
	}

	function patchRowText(path: readonly number[], text: string): void {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeRowTextUpdated(current.userShapes, path, text),
		} as PptxChartData);
	}

	function removeRow(path: readonly number[]): void {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeRowRemoved(current.userShapes, path),
		} as PptxChartData);
	}

	function patchRowBox(
		path: readonly number[],
		box: { from: { x: number; y: number }; to: { x: number; y: number } },
	): void {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeRowChartBoxUpdated(current.userShapes, path, box),
		} as PptxChartData);
	}

	function patchRowRotation(path: readonly number[], rotation: number | undefined): void {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeRowRotationUpdated(current.userShapes, path, rotation),
		} as PptxChartData);
	}

	function patchRowFlip(path: readonly number[], flip: { flipH?: boolean; flipV?: boolean }): void {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeRowFlipUpdated(current.userShapes, path, flip),
		} as PptxChartData);
	}

	function addIntoGroup(path: readonly number[]): void {
		if (!current) {
			return;
		}
		const transform = getChartUserShapeGroupTransform(current.userShapes, path);
		if (!transform) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeGroupChildAdded(
				current.userShapes,
				path,
				createDefaultChartUserShapeGroupChild(transform),
			),
		} as PptxChartData);
	}

	function buildRow(row: ChartUserShapeRow): HTMLElement {
		const rowEl = doc.createElement('div');
		rowEl.className = 'pptxv-chart-usershape-row';
		rowEl.dataset.testid = 'chart-user-shape-row';
		rowEl.dataset.chartUserShapePath = row.path.join(',');
		rowEl.style.marginLeft = `${row.depth * 12}px`;

		const label = doc.createElement('span');
		const kindKey = `pptx.chart.userShapeKind${row.kind.charAt(0).toUpperCase()}${row.kind.slice(1)}`;
		label.textContent = row.text ? `${t(kindKey)} - ${row.text}` : t(kindKey);

		const deleteButton = doc.createElement('button');
		deleteButton.type = 'button';
		deleteButton.dataset.testid = 'chart-user-shape-delete';
		deleteButton.setAttribute('aria-label', t('pptx.chart.userShapeDelete'));
		deleteButton.textContent = '✕';
		deleteButton.addEventListener('click', () => removeRow(row.path));

		const top = doc.createElement('div');
		top.className = 'pptxv-chart-usershape-top';
		top.append(label);
		if (row.isGroup) {
			const addIntoGroupButton = doc.createElement('button');
			addIntoGroupButton.type = 'button';
			addIntoGroupButton.dataset.testid = 'chart-user-shape-add-into-group';
			addIntoGroupButton.textContent = t('pptx.chart.userShapeAddIntoGroup');
			addIntoGroupButton.addEventListener('click', () => addIntoGroup(row.path));
			top.append(addIntoGroupButton);
		}
		top.append(deleteButton);
		rowEl.append(top);

		if (row.editableVisuals) {
			const textRow = doc.createElement('div');
			textRow.className = 'pptxv-chart-usershape-text';
			textRow.append(
				...labeledField(
					doc,
					t('pptx.chart.userShapeText'),
					textInput(doc, row.text ?? '', t('pptx.chart.userShapeText'), (text) =>
						patchRowText(row.path, text),
					),
				),
			);
			rowEl.append(textRow);

			const colorRow = doc.createElement('div');
			colorRow.className = 'pptxv-chart-usershape-colors';
			colorRow.append(
				...labeledField(
					doc,
					t('pptx.chart.userShapeFill'),
					colorInput(doc, row.fill ?? '#ffffff', t('pptx.chart.userShapeFill'), (fill) =>
						patchRow(row.path, { fill }),
					),
				),
				...labeledField(
					doc,
					t('pptx.chart.userShapeStroke'),
					colorInput(doc, row.stroke ?? '#000000', t('pptx.chart.userShapeStroke'), (stroke) =>
						patchRow(row.path, { stroke }),
					),
				),
			);
			rowEl.append(colorRow);
		}

		if (row.editableAltText) {
			const altRow = doc.createElement('div');
			altRow.className = 'pptxv-chart-usershape-alt-text';
			altRow.append(
				...labeledField(
					doc,
					t('pptx.chart.userShapeAltText'),
					textInput(doc, row.altText ?? '', t('pptx.chart.userShapeAltText'), (altText) =>
						patchRow(row.path, { altText }),
					),
				),
			);
			rowEl.append(altRow);
		}

		// Every row (including a grpSp group header) is position/size editable:
		// a top-level group's own drawing anchor moves/resizes it, and a nested
		// row edits a chart-relative from/to fraction.
		rowEl.append(
			buildPositionControls(
				doc,
				t,
				row,
				current,
				patchRow,
				patchRowBox,
				patchRowRotation,
				patchRowFlip,
			),
		);

		return rowEl;
	}

	function render(data: PptxChartData): void {
		current = data;
		list.replaceChildren();
		const rows = listChartUserShapeRows(data.userShapes);
		empty.hidden = rows.length > 0;
		for (const row of rows) {
			list.append(buildRow(row));
		}
	}

	return { el, update: render };
}
