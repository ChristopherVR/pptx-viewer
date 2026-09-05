import { filterValidShapeAdjustmentEntries } from '../../geometry/preset-adjustment-validation';
import type { XmlObject } from '../../types';
import type {
	ITextShapeXmlFactory,
	PptxBuilderFactoryContext,
	TextShapeXmlFactoryInit,
} from './types';

/**
 * Factory that produces OpenXML `p:sp` (shape) XML objects for text boxes and rectangles.
 *
 * Generates shape XML including:
 * - `p:nvSpPr` with a unique ID and `txBox` flag
 * - `p:spPr` with transform (`a:xfrm`), preset geometry, and shape adjustments
 * - `p:txBody` with body properties, list style, and a single text run
 */
export class TextShapeXmlFactory implements ITextShapeXmlFactory {
	private readonly context: PptxBuilderFactoryContext;

	/** @param context - Shared factory context providing ID generation and unit conversion. */
	public constructor(context: PptxBuilderFactoryContext) {
		this.context = context;
	}

	/**
	 * Create a `p:sp` XML object from a text/shape element model.
	 * @param init - Initialization data containing the element with text.
	 * @returns A complete OpenXML shape XML object with text body.
	 */
	public createXmlElement(init: TextShapeXmlFactoryInit): XmlObject {
		const { element } = init;
		// Distinguish text boxes from generic rectangles for the cNvSpPr txBox attribute
		const isText = element.type === 'text';
		// Prefer the parsed `@txBox` flag (round-tripped via `locks.txBox`) so a
		// rebuilt shape keeps its original text-box classification; fall back to
		// the element type for SDK-created shapes with no parsed flag.
		const isTextBox = element.locks?.txBox ?? isText;
		const name = isText ? 'TextBox' : 'Rectangle';
		const geometry = this.context.normalizePresetGeometry(element.shapeType);
		// Build a:avLst (adjustment values list) for shapes with custom guide
		// values. Filtered to the resolved preset's real ECMA-376 guide names:
		// an unrecognised `<a:gd>` name (e.g. `adj1` on `homePlate`, which only
		// defines `adj`) makes PowerPoint refuse to open the file even though
		// the XML is otherwise schema-valid (COM-verified) - see
		// `filterValidShapeAdjustmentEntries`. This mirrors the same filtering
		// `applyGeometryUpdate` re-applies at save time, which is the ultimate
		// authority for what reaches the file; keeping both in sync avoids a
		// misleading in-memory shape that looks different from what gets saved.
		const adjustmentEntries = filterValidShapeAdjustmentEntries(geometry, element.shapeAdjustments);
		const avLst =
			adjustmentEntries.length > 0
				? {
						'a:gd': adjustmentEntries.map(([key, value]) => ({
							'@_name': key,
							'@_fmla': `val ${Math.round(value)}`,
						})),
					}
				: {};

		const elementId = this.context.getNextId();

		return {
			'p:nvSpPr': {
				'p:cNvPr': {
					'@_id': String(elementId),
					'@_name': `${name} ${elementId}`,
				},
				'p:cNvSpPr': {
					'@_txBox': isTextBox ? '1' : '0',
				},
				'p:nvPr': {},
			},
			'p:spPr': {
				'a:xfrm': {
					'a:off': {
						'@_x': String(Math.round(element.x * this.context.emuPerPx)),
						'@_y': String(Math.round(element.y * this.context.emuPerPx)),
					},
					'a:ext': {
						'@_cx': String(Math.round(element.width * this.context.emuPerPx)),
						'@_cy': String(Math.round(element.height * this.context.emuPerPx)),
					},
					'@_rot': element.rotation ? String(Math.round(element.rotation * 60000)) : undefined,
					'@_flipH': element.flipHorizontal ? '1' : undefined,
					'@_flipV': element.flipVertical ? '1' : undefined,
				},
				'a:prstGeom': {
					'@_prst': geometry,
					'a:avLst': avLst,
				},
			},
			'p:txBody': {
				'a:bodyPr': {
					'@_wrap': 'square',
					'@_anchor': this.context.toDrawingTextVerticalAlign(element.textStyle?.vAlign),
				},
				'a:lstStyle': {},
				'a:p': [
					{
						'a:r': {
							'a:rPr': { '@_lang': 'en-US' },
							'a:t': isText ? element.text : '',
						},
					},
				],
			},
		};
	}
}
