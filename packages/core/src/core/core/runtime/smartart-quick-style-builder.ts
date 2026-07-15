import type { XmlObject } from '../../types';
import type { PptxSmartArtQuickStyle } from '../../types/smart-art';
import {
	applySmartArtDefinitionMetadata,
	applySmartArtQuickStyleLabels,
} from './smartart-definition-builder';

type LocalNameResolver = (key: string) => string;

/** Merge editable CT_StyleDefinition metadata while preserving complex style payloads. */
export function applySmartArtQuickStyle(
	styleDef: XmlObject,
	quickStyle: PptxSmartArtQuickStyle | undefined,
	localName: LocalNameResolver,
): boolean {
	if (!quickStyle) {
		return false;
	}
	let changed = applySmartArtDefinitionMetadata(styleDef, quickStyle, localName);
	changed = applySmartArtQuickStyleLabels(styleDef, quickStyle.labels, localName) || changed;
	return changed;
}
