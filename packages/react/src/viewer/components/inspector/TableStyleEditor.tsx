import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import {
	addTableStyleToMap,
	createTableStyleEntry,
	deleteTableStyleFromMap,
	normalizeTableStyleGuid,
} from 'pptx-viewer-core';
import type { TableStyleEditorFieldEdit, TableStyleEditorPartId } from 'pptx-viewer-shared';
import {
	applyTableStyleFieldEdit,
	describeTableStyleEditor,
	TABLE_STYLE_EDITOR_PARTS,
} from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BTN, CARD, HEADING } from './inspector-pane-constants';
import { TableStyleEditorFields } from './TableStyleEditorFields';
import { useThemeColorMap } from './ThemeColorMapContext';

export interface TableStyleEditorProps {
	styleMap: ParsedTableStyleMap | undefined;
	/** The style currently assigned to the table being edited. */
	styleId: string | undefined;
	canEdit: boolean;
	/** Commit a full replacement style map (section edit, create, or delete already applied). */
	onStyleMapChange: (nextMap: ParsedTableStyleMap) => void;
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	onDeleteStyle: (styleId: string) => void;
	/** Optional: assign a newly-created style to the table being edited. */
	onAssignStyle?: (styleId: string) => void;
	onClose: () => void;
}

/**
 * "Edit style..." panel for a table style's own DEFINITION (`a:tblStyleLst`
 * section fill/text/borders/cell3D), distinct from `TablePropertiesPanel`'s
 * "which style does this table use" picker. Renders inline in the inspector
 * (mirrors `ThemeEditorPanel`), not a modal, so it can sit directly under the
 * button that opens it.
 */
export function TableStyleEditor({
	styleMap,
	styleId,
	canEdit,
	onStyleMapChange,
	onDeleteStyle,
	onAssignStyle,
	onClose,
}: TableStyleEditorProps): React.ReactElement {
	const { t } = useTranslation();
	const themeColorMap = useThemeColorMap();
	const [activeStyleId, setActiveStyleId] = useState(
		styleId ? normalizeTableStyleGuid(styleId) : '',
	);
	const [selectedPart, setSelectedPart] = useState<TableStyleEditorPartId>('wholeTbl');

	const entry = activeStyleId ? styleMap?.[activeStyleId] : undefined;
	const descriptor = describeTableStyleEditor(entry, selectedPart, themeColorMap);

	function edit(fieldEdit: TableStyleEditorFieldEdit): void {
		if (!entry || !styleMap) {
			return;
		}
		const { entry: nextEntry } = applyTableStyleFieldEdit(entry, selectedPart, fieldEdit);
		onStyleMapChange({ ...styleMap, [nextEntry.styleId]: nextEntry });
	}

	function createFromCurrent(): void {
		const name = window.prompt(
			t('pptx.tableStyleEditor.newStyleNamePrompt'),
			entry ? `${entry.styleName ?? ''} Copy`.trim() : '',
		);
		if (!name) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...(styleMap ?? {}) };
		const created = createTableStyleEntry(nextMap, { styleName: name, basedOn: entry });
		addTableStyleToMap(nextMap, created);
		onStyleMapChange(nextMap);
		setActiveStyleId(created.styleId);
		onAssignStyle?.(created.styleId);
	}

	function handleDelete(): void {
		if (!entry || !styleMap || !window.confirm(t('pptx.tableStyleEditor.deleteConfirm'))) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...styleMap };
		deleteTableStyleFromMap(nextMap, entry.styleId);
		onStyleMapChange(nextMap);
		onDeleteStyle(entry.styleId);
		onClose();
	}

	return (
		<div className={CARD} data-testid='table-style-editor'>
			<div className='flex items-center justify-between'>
				<div className={HEADING}>{t('pptx.tableStyleEditor.title')}</div>
				<button type='button' className={BTN} onClick={onClose}>
					{t('pptx.tableStyleEditor.close')}
				</button>
			</div>

			{!entry && (
				<div className='text-[11px] text-muted-foreground'>
					{t('pptx.tableStyleEditor.noStyleSelected')}
				</div>
			)}

			{entry && (
				<div className='flex flex-wrap gap-1'>
					{TABLE_STYLE_EDITOR_PARTS.map((part) => (
						<button
							key={part.id}
							type='button'
							disabled={!canEdit}
							className={`${BTN} ${selectedPart === part.id ? 'bg-accent' : ''}`}
							onClick={() => setSelectedPart(part.id)}
						>
							{t(part.labelKey)}
						</button>
					))}
				</div>
			)}

			{descriptor && (
				<TableStyleEditorFields descriptor={descriptor} canEdit={canEdit} onEdit={edit} />
			)}

			<div className='flex gap-1.5 pt-1 border-t border-border'>
				<button type='button' className={BTN} disabled={!canEdit} onClick={createFromCurrent}>
					{entry ? t('pptx.tableStyleEditor.newFromCurrent') : t('pptx.tableStyleEditor.newStyle')}
				</button>
				{entry && (
					<button type='button' className={BTN} disabled={!canEdit} onClick={handleDelete}>
						{t('pptx.tableStyleEditor.deleteStyle')}
					</button>
				)}
			</div>
		</div>
	);
}
