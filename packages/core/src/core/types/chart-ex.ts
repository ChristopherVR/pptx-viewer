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
 * The flags parse purely (`parseChartDataPointPicture` in
 * `utils/chart-datapoint-serializer.ts`); {@link imageUrl} is a separate,
 * later addition populated by the runtime (`PptxHandlerRuntimeChartParsing.ts`)
 * once the sibling `c:spPr/a:blipFill/a:blip`'s `r:embed`/`r:link` is resolved
 * against the chart part's relationships, since that resolution needs zip/file
 * access the pure parser does not have.
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
	/**
	 * Resolved picture source (a `data:`/`blob:` URL) for the point's sibling
	 * `c:spPr/a:blipFill/a:blip`. Populated by the runtime after relationship
	 * resolution (C2-G9 render half); absent until then, and absent entirely
	 * when the point has no picture fill or the image could not be resolved.
	 */
	imageUrl?: string;
}
