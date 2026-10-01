import type { PptxUiRibbonDrawElement, RibbonDrawRequestEvent } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { DrawingTool } from '../../types';
import { useRecentColors } from '../inspector/RecentColorsContext';

export interface DrawSectionProps {
	activeTool: DrawingTool;
	drawingColor: string;
	drawingWidth: number;
	canEdit?: boolean;
	onSetActiveTool: (tool: DrawingTool) => void;
	onSetDrawingColor: (color: string) => void;
	onSetDrawingWidth: (width: number) => void;
}

export function DrawSection(p: DrawSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor, recentColors } = useRecentColors();
	const ref = useRef<PptxUiRibbonDrawElement>(null);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = {
			tool: p.activeTool,
			color: p.drawingColor,
			width: p.drawingWidth,
			editable: p.canEdit !== false,
			recentColors,
			translate: t,
		};
	}, [p, recentColors, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => {
			if (p.canEdit === false) {
				return;
			}
			const intent = (event as RibbonDrawRequestEvent).detail;
			switch (intent.kind) {
				case 'tool':
					p.onSetActiveTool(intent.value);
					break;
				case 'width':
					p.onSetDrawingWidth(intent.value);
					break;
				case 'color':
					p.onSetDrawingColor(intent.value);
					if (intent.committed) {
						pushColor(intent.value);
					}
			}
		};
		host.addEventListener('draw-request', request);
		return () => host.removeEventListener('draw-request', request);
	}, [p, pushColor]);
	return <pptx-ui-ribbon-draw ref={ref} />;
}
