import type { SmartArtStyle, XmlObject } from '../../types';
import type { PptxSmartArtQuickStyle } from '../../types/smart-art';
import {
	applySmartArtDefinitionMetadata,
	applySmartArtQuickStyleLabels,
} from './smartart-definition-builder';
import { applySmartArtStyleIntensity } from './smartart-style-intensity-builder';

type LocalNameResolver = (key: string) => string;

/** Merge editable CT_StyleDefinition metadata while preserving complex style payloads. */
export function applySmartArtQuickStyle(
	styleDef: XmlObject,
	quickStyle: PptxSmartArtQuickStyle | undefined,
	localName: LocalNameResolver,
	intensity?: SmartArtStyle,
): boolean {
	if (!quickStyle) {
		return false;
	}
	let changed = applySmartArtDefinitionMetadata(styleDef, quickStyle, localName);
	changed = applySmartArtQuickStyleLabels(styleDef, quickStyle.labels, localName) || changed;
	changed = applySmartArtStyleIntensity(styleDef, intensity, localName) || changed;
	return changed;
}
