import type { InkPptxElement, XmlObject } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveOleEmbedding';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Serialize ink the editor's Draw tool authored (an ink element with no
	 * `rawXml`) as the `custGeom` freeform stroke shape PowerPoint accepts.
	 *
	 * It used to build a `p:graphicFrame` whose `a:graphicData` held an
	 * `mc:AlternateContent` with an `<aink:ink>` Choice and this same shape as
	 * the Fallback. **PowerPoint refuses to open a deck containing that frame**:
	 * "The file or directory is corrupted and unreadable (0x80070570)". Every
	 * deck a user drew on was unopenable, in all five bindings.
	 *
	 * Measured by bisecting one authored stroke through COM:
	 *
	 * | slide1.xml contains                              | PowerPoint |
	 * | ------------------------------------------------ | ---------- |
	 * | no ink at all (control)                          | opens      |
	 * | this `custGeom` `p:sp` alone                     | opens      |
	 * | the frame, `aink` Choice only (no Fallback)      | refuses    |
	 * | the frame, bare `<aink:ink>` (no MCE wrapper)    | refuses    |
	 *
	 * So the `mc:AlternateContent` wrapper was not the problem and the fallback
	 * shape was never the problem: the `.../2010/ink` graphic-data payload is.
	 * `aink:ink` is not markup PowerPoint reads there. Its own pen writes ink as
	 * a `p:contentPart` referencing an InkML part instead, which this codebase
	 * parses and re-serializes for `contentPart` elements
	 * (`PptxHandlerRuntimeSaveContentPartInk`); routing authored strokes through
	 * that path too, so they survive as editable ink rather than as a freeform
	 * shape, is the remaining work.
	 *
	 * Ink LOADED from a real file never reaches here: it carries its original
	 * markup on `rawXml` and is passed through verbatim by the element writer.
	 */
	protected createInkGraphicFrameXml(el: InkPptxElement): XmlObject {
		return this.createInkShapeXml(el);
	}
}
