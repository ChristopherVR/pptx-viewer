import type { ShapePresetType } from 'pptx-viewer-shared';
import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import type { SelectButtonHandle } from '../../../select-button';
import { makeSelectButton } from '../../../select-button';

/**
 * Insert > Shape: a shape-type `<select>` beside an insert button.
 *
 * This replaced a 30-button preset grid. The grid put thirty accessible names
 * on the Insert tab that no other binding offers, which made the tab
 * impossible to compare against the reference and buried the handful of
 * commands (Text Box, Table, Chart, ...) a user actually scans for. The full
 * catalogue is still reachable, one scroll of the select away.
 */
export function createShapeControl(
	doc: Document,
	t: Translator,
	onInsert: (shapeType: ShapePresetType) => void,
): SelectButtonHandle<ShapePresetType> {
	return makeSelectButton<ShapePresetType>(doc, {
		selectLabel: t('pptx.insert.shapeType'),
		buttonLabel: t('pptx.insert.shape'),
		buttonTitle: t('pptx.insert.addShape'),
		icon: 'shapes',
		items: SHAPE_PRESET_DEFS.map((preset) => ({ label: t(preset.i18nKey), value: preset.type })),
		onCommit: onInsert,
	});
}
