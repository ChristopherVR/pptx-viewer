import React from 'react';
import { useTranslation } from 'react-i18next';

import type { DrawingTool } from '../../types';
import { cn } from '../../utils';
import { gB, gL, grp, DRAW_TOOLS } from './toolbar-constants';

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

	return (
		<>
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
					>
						{tool.icon}
					</button>
				))}
			</div>
			<div className='inline-flex items-center gap-2 text-xs'>
				<label
					className='inline-flex items-center gap-1 text-muted-foreground'
					title={t('pptx.ribbon.penColour')}
				>
					{t('pptx.ribbon.colour')}
					<input
						type='color'
						value={p.drawingColor}
						onChange={(e) => p.onSetDrawingColor(e.target.value)}
						className='w-6 h-6 rounded border border-border bg-transparent cursor-pointer'
					/>
				</label>
				<label
					className='inline-flex items-center gap-1 text-muted-foreground'
					title={t('pptx.ribbon.strokeWidth')}
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
		</>
	);
}
