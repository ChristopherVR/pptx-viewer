import type { XmlObject } from '../../types';
import type { PptxSmartArtQuickStyle } from '../../types/smart-art';

/**
 * Surgically merge the in-memory quick style back into the parsed `styleDef`
 * element of a `ppt/diagrams/quickStyles*.xml` part.
 *
 * Only the `styleDef/@_title` is refreshed from `name`. The `effectIntensity`
 * value carried in memory is a derived interpretation of the part's `styleLbl`
 * names (see the loader), not a single canonical attribute, so synthesising
 * `styleLbl` structures from it would risk corrupting the part. The label
 * structures, effect references, ext lists, and `@_uniqueId` are therefore
 * preserved verbatim; PowerPoint re-derives effect intensity from them.
 *
 * @returns true when the title was written, false when nothing changed.
 */
export function applySmartArtQuickStyle(
	styleDef: XmlObject,
	quickStyle: PptxSmartArtQuickStyle | undefined,
): boolean {
	if (!quickStyle || !quickStyle.name || quickStyle.name.length === 0) {
		return false;
	}
	if (styleDef['@_title'] === quickStyle.name) {
		return false;
	}
	styleDef['@_title'] = quickStyle.name;
	return true;
}
