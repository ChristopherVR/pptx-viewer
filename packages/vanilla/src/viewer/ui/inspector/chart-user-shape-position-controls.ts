/**
 * Position/size controls for one chart overlay row, split out of
 * `chart-user-shape-section.ts` to stay under this repo's file-size
 * guideline (W2-F grouped-child tree editing grew the row renderer past a
 * single file).
 *
 * At depth 0, the anchor markers directly (rel `from`/`to` fractions, or abs
 * `from` + `ext` EMU: a top-level `grpSp` row's anchor already moves/resizes
 * the whole group with children following, see shared
 * `chart-user-shape-tree.ts`'s `editablePosition` doc). Nested (INCLUDING a
 * nested `grpSp` group header), a `from`/`to` chart-relative fraction pair
 * instead of raw EMU (shared `chart-user-shape-row-frame.ts`), matching how
 * a top-level `relSizeAnchor` row already edits.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import type { ChartUserShapeRow, ChartUserShapeRowPatch } from 'pptx-viewer-shared';
import { getChartUserShapeRowChartBox } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import {
	checkboxInput,
	emuInput,
	fractionInput,
	labeledField,
	labeledNumberInput,
} from './chart-user-shape-row-controls';

export function buildPositionControls(
	doc: Document,
	t: Translator,
	row: ChartUserShapeRow,
	current: PptxChartData | undefined,
	patchAnchor: (path: readonly number[], patch: ChartUserShapeRowPatch) => void,
	patchBox: (
		path: readonly number[],
		box: { from: { x: number; y: number }; to: { x: number; y: number } },
	) => void,
	patchRotation: (path: readonly number[], rotation: number | undefined) => void,
	patchFlip: (path: readonly number[], flip: { flipH?: boolean; flipV?: boolean }) => void,
): HTMLElement {
	const wrap = doc.createElement('div');
	wrap.className = 'pptxv-chart-usershape-anchor';
	const rotationField = (): HTMLElement[] =>
		labeledField(
			doc,
			t('pptx.chart.userShapeRotation'),
			labeledNumberInput(
				doc,
				row.rotation ?? 0,
				t('pptx.chart.userShapeRotation'),
				'1',
				(rotation) => patchRotation(row.path, rotation || undefined),
			),
		);
	const flipFields = (): HTMLElement[] => [
		...labeledField(
			doc,
			t('pptx.arrange.flipHorizontally'),
			checkboxInput(doc, row.flipH ?? false, t('pptx.arrange.flipHorizontally'), (flipH) =>
				patchFlip(row.path, { flipH }),
			),
		),
		...labeledField(
			doc,
			t('pptx.arrange.flipVertically'),
			checkboxInput(doc, row.flipV ?? false, t('pptx.arrange.flipVertically'), (flipV) =>
				patchFlip(row.path, { flipV }),
			),
		),
	];
	if (row.depth === 0) {
		const from = row.from!;
		wrap.append(
			...labeledField(
				doc,
				t('pptx.chart.userShapeFrom'),
				fractionInput(doc, from.x, (x) => patchAnchor(row.path, { from: { ...from, x } })),
				fractionInput(doc, from.y, (y) => patchAnchor(row.path, { from: { ...from, y } })),
			),
		);
		if (row.anchor === 'rel' && row.to) {
			const to = row.to;
			wrap.append(
				...labeledField(
					doc,
					t('pptx.chart.userShapeTo'),
					fractionInput(doc, to.x, (x) => patchAnchor(row.path, { to: { ...to, x } })),
					fractionInput(doc, to.y, (y) => patchAnchor(row.path, { to: { ...to, y } })),
				),
			);
		}
		if (row.anchor === 'abs' && row.ext) {
			const ext = row.ext;
			wrap.append(
				...labeledField(
					doc,
					t('pptx.chart.userShapeSize'),
					emuInput(doc, ext.cx, (cx) => patchAnchor(row.path, { ext: { ...ext, cx } })),
					emuInput(doc, ext.cy, (cy) => patchAnchor(row.path, { ext: { ...ext, cy } })),
				),
			);
		}
		wrap.append(...rotationField(), ...flipFields());
		return wrap;
	}
	const box = getChartUserShapeRowChartBox(current?.userShapes, row.path);
	if (!box) {
		return wrap;
	}
	wrap.append(
		...labeledField(
			doc,
			t('pptx.chart.userShapeFrom'),
			fractionInput(doc, box.from.x, (x) =>
				patchBox(row.path, { from: { ...box.from, x }, to: box.to }),
			),
			fractionInput(doc, box.from.y, (y) =>
				patchBox(row.path, { from: { ...box.from, y }, to: box.to }),
			),
		),
		...labeledField(
			doc,
			t('pptx.chart.userShapeTo'),
			fractionInput(doc, box.to.x, (x) =>
				patchBox(row.path, { from: box.from, to: { ...box.to, x } }),
			),
			fractionInput(doc, box.to.y, (y) =>
				patchBox(row.path, { from: box.from, to: { ...box.to, y } }),
			),
		),
		...rotationField(),
		...flipFields(),
	);
	return wrap;
}
