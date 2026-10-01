import {
	DEFAULT_INSERT_CHART_KIND,
	FREEFORM_TOOL_IDS,
	isDrawingToolVisible,
} from 'pptx-viewer-shared';
import type {
	FreeformToolKind,
	InsertChartKind,
	PptxUiRibbonInsertElement,
	RibbonInsertRequestEvent,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedShapeType } from '../../types';
import { useViewerCustomizationContext } from '../viewer-customization-context';
import { DateTimeFieldDialog } from './DateTimeFieldDialog';

export interface InsertSectionProps {
	canEdit: boolean;
	newShapeType: SupportedShapeType;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	/** The armed Freeform: Shape / Curve tool, or null. */
	activeFreeformTool?: FreeformToolKind | null;
	/** Arm (or, with null, disarm) a Freeform: Shape / Curve tool. */
	onArmFreeformTool?: (tool: FreeformToolKind | null) => void;
	onAddTextBox: () => void;
	onAddShape: () => void;
	onAddTable: () => void;
	onAddChart?: (chartKind: InsertChartKind) => void;
	onAddSmartArt: () => void;
	onAddEquation: () => void;
	onAddActionButton: (shapeType: string) => void;
	onInsertField?: (fieldType: string, value?: string) => void;
	onOpenHeaderFooter?: () => void;
	onOpenImagePicker: () => void;
	onOpenMediaPicker: () => void;
	/** True when something is selected, so a link has a target to attach to. */
	hasSelection: boolean;
	onOpenHyperlinkDialog: () => void;
}

/**
 * Thin adapter over `pptx-ui-ribbon-insert`. Document mutation, the file/SmartArt/
 * equation/hyperlink/header-footer dialogs and the Date/Time picker stay native.
 */
export function InsertSection(p: InsertSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const customization = useViewerCustomizationContext();
	const ref = useRef<PptxUiRibbonInsertElement>(null);
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [chartKind, setChartKind] = useState<InsertChartKind>(DEFAULT_INSERT_CHART_KIND);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = {
			editable: p.canEdit,
			hasSelection: p.hasSelection,
			shapeType: p.newShapeType,
			chartKind,
			activeFreeformTool: p.activeFreeformTool ?? null,
			freeformTools: p.onArmFreeformTool
				? FREEFORM_TOOL_IDS.filter((tool) => isDrawingToolVisible(customization, tool))
				: [],
			chartAvailable: Boolean(p.onAddChart),
			fieldAvailable: Boolean(p.onInsertField),
			headerFooterAvailable: Boolean(p.onOpenHeaderFooter),
			translate: t,
		};
	}, [p, chartKind, customization, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => {
			const intent = (event as RibbonInsertRequestEvent).detail;
			switch (intent.kind) {
				case 'command': {
					const commands = {
						textBox: p.onAddTextBox,
						table: p.onAddTable,
						image: p.onOpenImagePicker,
						media: p.onOpenMediaPicker,
						smartArt: p.onAddSmartArt,
						equation: p.onAddEquation,
						link: p.onOpenHyperlinkDialog,
						headerFooter: p.onOpenHeaderFooter,
					};
					commands[intent.value]?.();
					break;
				}
				case 'shapeType':
					p.onSetNewShapeType(intent.value as SupportedShapeType);
					break;
				case 'shape':
					p.onAddShape();
					break;
				case 'chartType':
					setChartKind(intent.value as InsertChartKind);
					break;
				case 'chart':
					p.onAddChart?.(intent.value as InsertChartKind);
					break;
				case 'freeform':
					p.onArmFreeformTool?.(intent.value as FreeformToolKind | null);
					break;
				case 'actionButton':
					p.onAddActionButton(intent.value);
					break;
				case 'field':
					if (intent.value === 'datetime') {
						setDatePickerOpen(true);
					} else {
						p.onInsertField?.(intent.value);
					}
			}
		};
		host.addEventListener('insert-request', request);
		return () => host.removeEventListener('insert-request', request);
	}, [p]);
	return (
		<>
			<pptx-ui-ribbon-insert ref={ref} />
			{datePickerOpen && p.onInsertField && (
				<DateTimeFieldDialog
					onClose={() => setDatePickerOpen(false)}
					onInsert={(formatted) => {
						p.onInsertField?.('datetime', formatted);
						setDatePickerOpen(false);
					}}
				/>
			)}
		</>
	);
}
