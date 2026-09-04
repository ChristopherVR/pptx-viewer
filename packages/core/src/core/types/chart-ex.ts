/**
 * Chart-formatting types that don't fit an existing, owned type module for
 * this wave (`types/chart.ts` is owned elsewhere; see its own module doc).
 * Despite the file name, `PptxChartDataPointPicture` is a CLASSIC (`c:`)
 * construct, not ChartEx (`cx:`) - it landed here only because it needs a
 * home outside `chart.ts`.
 *
 * @module pptx-types/chart-ex
 */

/** `c:dPt/c:pictureOptions/c:pictureFormat/@val` (ST_PictureFormat). */
export type PptxChartPictureFormat = 'stretch' | 'stack' | 'stackScale';

/**
 * Per-data-point picture-fill flags (`c:dPt/c:pictureOptions`): PowerPoint's
 * "Picture or texture fill" with "Stack"/"Stretch" semantics on a bar/column
 * data point, distinct from the point's plain `c:spPr` solid/gradient fill.
 *
 * The picture itself lives in the sibling `c:spPr/a:blipFill` and is
 * intentionally not modeled here: resolving its `r:embed`/`r:link` needs the
 * runtime's relationship map, which the pure-parse helper that populates this
 * type (`parseChartDataPointPicture` in `utils/chart-datapoint-serializer.ts`)
 * does not have access to.
 */
export interface PptxChartDataPointPicture {
	/** Apply the picture to the front face of a 3-D bar/column (`c:applyToFront`). */
	applyToFront?: boolean;
	/** Apply the picture to the side faces of a 3-D bar/column (`c:applyToSides`). */
	applyToSides?: boolean;
	/** Apply the picture to the end face of a 3-D bar/column (`c:applyToEnd`). */
	applyToEnd?: boolean;
	/** Stretch, or stack repeated tiles at their natural size (or scaled). */
	pictureFormat?: PptxChartPictureFormat;
	/** Height, in points, of one repeated picture tile for "stack"/"stackScale" (`c:pictureStackUnit/@val`). */
	pictureStackUnit?: number;
}
