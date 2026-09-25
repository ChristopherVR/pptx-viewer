import type { RibbonControlId } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { DrawingTool } from '../../types';
import { cn } from '../../utils';
import { useRecentColors } from '../inspector/RecentColorsContext';
import { controlAttr, RibbonGroupScope } from './PowerPointRibbonControls';
import { gB, gL, grp, DRAW_TOOLS } from './toolbar-constants';

/** Catalogue ids of the drawing tools (Freeform has none). */
const DRAW_TOOL_CONTROL: Partial<Record<DrawingTool, RibbonControlId>> = {
	select: 'draw.tools.select',
	pen: 'draw.tools.pen',
	highlighter: 'draw.tools.highlighter',
	eraser: 'draw.tools.eraser',
};

export interface DrawSectionProps {
	activeTool: DrawingTool;
	drawingColor: string;
	drawingWidth: number;
	onSetActiveTool: (tool: DrawingTool) => void;
	onSetDrawingColor: (color: string) => void;
	onSetDrawingWidth: (width: number) => void;
}

export function DrawSection(p: DrawSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor } = useRecentColors();

	// The pen colour joins the deck's "Recent colours" list like every other
	// picker, but only on the native `change` (the committed pick): React's
	// `onChange` is the continuous `input` stream while the dialog is dragged,
	// which must keep driving the live pen colour without flooding the list.
	const colorRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		const el = colorRef.current;
		if (!el) {
			return;
		}
		const handler = () => pushColor(el.value);
		el.addEventListener('change', handler);
		return () => el.removeEventListener('change', handler);
	}, [pushColor]);

	return (
		<RibbonGroupScope id='draw.tools'>
			<div className={grp}>
				{DRAW_TOOLS.map((tool, i, a) => (
					<button
						key={tool.id}
						type='button'
						onClick={() => p.onSetActiveTool(tool.id)}
						className={cn(
							i < a.length - 1 ? gB : gL,
							p.activeTool === tool.id ? (tool.ac ?? 'bg-accent text-foreground') : '',
						)}
						title={t(tool.labelKey)}
						{...controlAttr(DRAW_TOOL_CONTROL[tool.id])}
					>
						{tool.icon}
					</button>
				))}
			</div>
			<div className='inline-flex items-center gap-2 text-xs'>
				<label
					className='inline-flex items-center gap-1 text-muted-foreground'
					title={t('pptx.ribbon.penColour')}
					{...controlAttr('draw.tools.penColor')}
				>
					{t('pptx.ribbon.colour')}
					<input
						ref={colorRef}
						type='color'
						value={p.drawingColor}
						onChange={(e) => p.onSetDrawingColor(e.target.value)}
						className='w-6 h-6 rounded border border-border bg-transparent cursor-pointer'
					/>
				</label>
				<label
					className='inline-flex items-center gap-1 text-muted-foreground'
					title={t('pptx.ribbon.strokeWidth')}
					{...controlAttr('draw.tools.penWidth')}
				>
					{t('pptx.ribbon.width')}
					<input
						type='range'
						min={1}
						max={12}
						value={p.drawingWidth}
						onChange={(e) => p.onSetDrawingWidth(Number(e.target.value))}
						className='w-16 h-1 accent-primary'
					/>
					<span className='text-foreground w-4 text-right'>{p.drawingWidth}</span>
				</label>
			</div>
		</RibbonGroupScope>
	);
}
