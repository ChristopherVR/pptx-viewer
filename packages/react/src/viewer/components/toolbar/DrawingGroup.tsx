import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { RibbonHomeIntent } from 'pptx-viewer-shared';
import {
	drawingHomeControls,
	homeGalleryApply,
	homeGalleryControls,
	shapeFillChange,
	shapeOutlineChange,
	withHomeGalleries,
} from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedShapeType } from '../../types-core';
import { useRecentColors } from '../inspector/RecentColorsContext';
import { useThemeColorMap } from '../inspector/ThemeColorMapContext';
import { useRibbonGalleryCommands } from '../ribbon-gallery-context';
import { groupAttr } from './PowerPointRibbonControls';
import { sep } from './toolbar-constants';
import { WebHomeControls } from './WebHomeControls';

export interface DrawingGroupProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	newShapeType: SupportedShapeType;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	onAddShape: () => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	/**
	 * Patch the selected shape's style. Optional only because the mobile menu
	 * sheet renders the group without one; the desktop ribbon always passes it.
	 */
	onUpdateElementStyle?: (style: Partial<ShapeStyle>) => void;
}

/**
 * Home > Drawing: the shared `pptx-ui-ribbon-home-drawing` strip renders the
 * Shapes and Arrange menus, the Fill and Outline colour popovers and the Quick
 * Styles / Shape Effects galleries; this adapter feeds state and runs the edits.
 */
export function DrawingGroup(p: DrawingGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const { recentColors, pushColor } = useRecentColors();
	const themeColors = useThemeColorMap();
	const commands = useRibbonGalleryCommands();
	const style: ShapeStyle | undefined =
		p.selectedElement && hasShapeProperties(p.selectedElement)
			? p.selectedElement.shapeStyle
			: undefined;
	const { onMoveLayer, onMoveLayerToEdge, onSetNewShapeType, onAddShape, onUpdateElementStyle } = p;
	const hasSelection = Boolean(p.selectedElement);

	const controls = useMemo(
		() =>
			withHomeGalleries(
				drawingHomeControls({
					editable: p.canEdit,
					hasSelection,
					shapeType: p.newShapeType,
					fill: {
						value: style?.fillColor ?? '#ffffff',
						ref: style?.fillColorRef,
						themeColors,
						recent: recentColors,
					},
					outline: {
						value: style?.strokeColor ?? '#000000',
						ref: style?.strokeColorRef,
						themeColors,
						recent: recentColors,
					},
				}),
				homeGalleryControls('drawing', commands?.context ?? { element: null }, p.canEdit),
				p.canEdit,
			),
		[p.canEdit, hasSelection, p.newShapeType, style, themeColors, recentColors, commands?.context],
	);
	const request = useCallback(
		(id: string, _part?: string, intent?: RibbonHomeIntent) => {
			const value = intent?.value;
			if (value === undefined) {
				return;
			}
			switch (id) {
				case 'home.drawing.shapes':
					onSetNewShapeType(value as SupportedShapeType);
					onAddShape();
					break;
				case 'home.drawing.arrange':
					if (value === 'forward' || value === 'backward') {
						onMoveLayer(value);
					} else {
						onMoveLayerToEdge(String(value));
					}
					break;
				case 'home.drawing.shapeFill':
					onUpdateElementStyle?.(shapeFillChange(String(value), intent?.ref));
					pushColor(String(value));
					break;
				case 'home.drawing.shapeOutline':
					onUpdateElementStyle?.(shapeOutlineChange(String(value), intent?.ref));
					pushColor(String(value));
					break;
				default:
					if (commands?.editable) {
						const result = homeGalleryApply('drawing', id, String(value), commands.context);
						if (result) {
							commands.dispatch(result);
						}
					}
			}
		},
		[
			onMoveLayer,
			onMoveLayerToEdge,
			onSetNewShapeType,
			onAddShape,
			onUpdateElementStyle,
			pushColor,
			commands,
		],
	);

	return (
		<>
			<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.drawing')}>
				<div className='flex items-center gap-1' data-pptx-chrome='drawing-controls'>
					<WebHomeControls family='drawing' controls={controls} onRequest={request} />
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.ribbon.groupDrawing')}
				</span>
			</div>

			{sep}
		</>
	);
}
