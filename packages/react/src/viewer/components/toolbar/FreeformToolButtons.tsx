import type { FreeformToolKind } from 'pptx-viewer-shared';
import {
	FREEFORM_TOOL_IDS,
	FREEFORM_TOOL_LABEL_KEYS,
	isDrawingToolVisible,
} from 'pptx-viewer-shared';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { LuPenTool, LuSpline } from 'react-icons/lu';

import { cn } from '../../utils';
import { useViewerCustomizationContext } from '../viewer-customization-context';
import { ic, pill } from './toolbar-constants';

const ICONS: Record<FreeformToolKind, React.ElementType> = {
	freeformShape: LuPenTool,
	curve: LuSpline,
};

export interface FreeformToolButtonsProps {
	canEdit: boolean;
	activeTool: FreeformToolKind | null | undefined;
	onArm: (tool: FreeformToolKind | null) => void;
}

/**
 * Insert > Shapes' click-to-place drawing tools (Freeform: Shape, Curve). A
 * press arms the tool (press again to disarm); the drawing itself happens on
 * the canvas overlay. Hosts can hide either through `hiddenDrawingTools`.
 */
export function FreeformToolButtons({
	canEdit,
	activeTool,
	onArm,
}: FreeformToolButtonsProps): React.ReactElement | null {
	const { t } = useTranslation();
	const customization = useViewerCustomizationContext();
	const tools = FREEFORM_TOOL_IDS.filter((tool) => isDrawingToolVisible(customization, tool));
	if (tools.length === 0) {
		return null;
	}
	return (
		<>
			{tools.map((tool) => {
				const Icon = ICONS[tool];
				const active = activeTool === tool;
				return (
					<button
						key={tool}
						type='button'
						disabled={!canEdit}
						aria-pressed={active}
						data-pptx-drawing-tool={tool}
						className={cn(pill, active && 'bg-primary/15 text-primary')}
						title={t(FREEFORM_TOOL_LABEL_KEYS[tool])}
						onClick={() => onArm(active ? null : tool)}
					>
						<Icon className={ic} />
						{t(FREEFORM_TOOL_LABEL_KEYS[tool])}
					</button>
				);
			})}
		</>
	);
}
