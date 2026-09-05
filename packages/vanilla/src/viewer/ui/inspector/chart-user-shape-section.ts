/**
 * chart-user-shape-section.ts: "Chart overlay shapes" section (`c:userShapes`
 * drawing overlay, C2-G10 edit/serialize follow-up), mirroring React's
 * `inspector/ChartUserShapeOptions.tsx`.
 *
 * List existing overlay shapes, add a default text box, delete one, and
 * nudge a `sp`/`cxnSp` shape's anchor fractions. All decision logic (the
 * descriptor list, the default shape, the array edits) lives in
 * `pptx-viewer-shared`'s `chart-user-shape-edit` module; this file only maps
 * it onto plain DOM controls (CLAUDE.md Rule 2).
 */
import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import {
	createDefaultChartUserShape,
	listChartUserShapeDescriptors,
	withChartUserShapeAdded,
	withChartUserShapeRemoved,
	withChartUserShapeUpdated,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';

export interface ChartUserShapeSection {
	el: HTMLElement;
	update(data: PptxChartData): void;
}

function numberInput(
	doc: Document,
	value: number,
	onChange: (next: number) => void,
): HTMLInputElement {
	const control = doc.createElement('input');
	control.type = 'number';
	control.step = '0.01';
	control.min = '0';
	control.max = '1';
	control.value = String(value);
	control.addEventListener('change', () => onChange(Number(control.value)));
	return control;
}

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

	function patchAnchor(index: number, patch: Partial<PptxChartUserShape>): void {
		if (!current) {
			return;
		}
		onChange({
			userShapes: withChartUserShapeUpdated(current.userShapes, index, patch),
		} as PptxChartData);
	}

	function removeAt(index: number): void {
		if (!current) {
			return;
		}
		onChange({ userShapes: withChartUserShapeRemoved(current.userShapes, index) } as PptxChartData);
	}

	function render(data: PptxChartData): void {
		current = data;
		list.replaceChildren();
		const descriptors = listChartUserShapeDescriptors(data.userShapes);
		empty.hidden = descriptors.length > 0;

		for (const d of descriptors) {
			const row = doc.createElement('div');
			row.className = 'pptxv-chart-usershape-row';
			row.dataset.testid = 'chart-user-shape-row';

			const label = doc.createElement('span');
			const kindKey = `pptx.chart.userShapeKind${d.kind.charAt(0).toUpperCase()}${d.kind.slice(1)}`;
			label.textContent = d.text ? `${t(kindKey)} - ${d.text}` : t(kindKey);

			const deleteButton = doc.createElement('button');
			deleteButton.type = 'button';
			deleteButton.dataset.testid = 'chart-user-shape-delete';
			deleteButton.setAttribute('aria-label', t('pptx.chart.userShapeDelete'));
			deleteButton.textContent = '✕';
			deleteButton.addEventListener('click', () => removeAt(d.index));

			const top = doc.createElement('div');
			top.className = 'pptxv-chart-usershape-top';
			top.append(label, deleteButton);
			row.append(top);

			if (d.editable) {
				const anchorRow = doc.createElement('div');
				anchorRow.className = 'pptxv-chart-usershape-anchor';
				const fromLabel = doc.createElement('span');
				fromLabel.textContent = t('pptx.chart.userShapeFrom');
				const fromX = numberInput(doc, d.from.x, (x) =>
					patchAnchor(d.index, { from: { ...d.from, x } }),
				);
				const fromY = numberInput(doc, d.from.y, (y) =>
					patchAnchor(d.index, { from: { ...d.from, y } }),
				);
				anchorRow.append(fromLabel, fromX, fromY);
				if (d.anchor === 'rel' && d.to) {
					const to = d.to;
					const toLabel = doc.createElement('span');
					toLabel.textContent = t('pptx.chart.userShapeTo');
					const toX = numberInput(doc, to.x, (x) => patchAnchor(d.index, { to: { ...to, x } }));
					const toY = numberInput(doc, to.y, (y) => patchAnchor(d.index, { to: { ...to, y } }));
					anchorRow.append(toLabel, toX, toY);
				}
				row.append(anchorRow);
			} else {
				const note = doc.createElement('p');
				note.className = 'pptxv-chart-usershape-not-editable';
				note.textContent = t('pptx.chart.userShapeNotEditable');
				row.append(note);
			}

			list.append(row);
		}
	}

	return { el, update: render };
}
