import type { PptxElement, ShapeStyle, OlePptxElement, GroupPptxElement } from 'pptx-viewer-core';
import { getOleObjectTypeLabel } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { ConnectorArrowsSection } from './ConnectorArrowsSection';
import { CARD, HEADING, INPUT, BTN } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Connector Panel
// ---------------------------------------------------------------------------

interface ConnectorPanelProps {
	selectedElement: PptxElement;
	canEdit: boolean;
	onUpdateElementStyle: (patch: Partial<ShapeStyle>) => void;
}

export function ConnectorPanel({
	selectedElement,
	canEdit,
	onUpdateElementStyle,
}: ConnectorPanelProps): React.ReactElement | null {
	if (selectedElement.type !== 'connector') {
		return null;
	}
	// Delegates to ConnectorArrowsSection so the card offers the arrow SIZE
	// (width + length) alongside the head style. OOXML carries `w`/`len` on
	// `a:headEnd` / `a:tailEnd`, and the previous inline dropdown pair could
	// only ever write the head type, leaving the two size attributes editable
	// nowhere in React.
	return (
		<div className={CARD}>
			<div className={HEADING}>Connector</div>
			<ConnectorArrowsSection
				selectedShapeStyle={selectedElement.shapeStyle}
				canEdit={canEdit}
				onUpdateShapeStyle={onUpdateElementStyle}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Group Info Panel
// ---------------------------------------------------------------------------

interface GroupInfoPanelProps {
	selectedElement: PptxElement;
}

export function GroupInfoPanel({
	selectedElement,
}: GroupInfoPanelProps): React.ReactElement | null {
	if (selectedElement.type !== 'group') {
		return null;
	}
	const group = selectedElement as GroupPptxElement;
	return (
		<div className={CARD}>
			<div className={HEADING}>Group</div>
			<div className='text-[11px] text-muted-foreground'>
				{Array.isArray(group.children) ? `${group.children.length} children` : 'Grouped element'}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// OLE Properties Panel
// ---------------------------------------------------------------------------

interface OlePropertiesPanelProps {
	selectedElement: PptxElement;
}

export function OlePropertiesPanel({
	selectedElement,
}: OlePropertiesPanelProps): React.ReactElement | null {
	const { t } = useTranslation();
	if (selectedElement.type !== 'ole') {
		return null;
	}
	const ole = selectedElement as OlePptxElement;
	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.ole.title')}</div>
			<div className='space-y-1.5 text-[11px]'>
				<div className='flex items-center justify-between gap-2'>
					<span className='text-muted-foreground'>{t('pptx.ole.type')}</span>
					<span className='text-foreground truncate'>
						{getOleObjectTypeLabel(ole.oleObjectType)}
					</span>
				</div>
				{ole.fileName && (
					<div className='flex items-center justify-between gap-2'>
						<span className='text-muted-foreground'>{t('pptx.ole.fileName')}</span>
						<span className='text-foreground truncate' title={ole.fileName}>
							{ole.fileName}
						</span>
					</div>
				)}
				<div className='flex items-center justify-between gap-2'>
					<span className='text-muted-foreground'>{t('pptx.ole.linkStatus')}</span>
					<span
						className={cn(
							'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
							ole.isLinked ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400',
						)}
					>
						{ole.isLinked ? t('pptx.ole.linked') : t('pptx.ole.embedded')}
					</span>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Transform Panel (Rotation + Opacity)
// ---------------------------------------------------------------------------

interface TransformPanelProps {
	selectedElement: PptxElement;
	canEdit: boolean;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

export function TransformPanel({
	selectedElement,
	canEdit,
	onUpdateElement,
}: TransformPanelProps): React.ReactElement {
	return (
		<div className={CARD}>
			<div className={HEADING}>Transform</div>
			<div className='grid grid-cols-2 gap-1.5 text-[11px]'>
				<label className='flex flex-col gap-1'>
					<span className='text-muted-foreground'>Rotation (°)</span>
					<input
						type='number'
						disabled={!canEdit}
						className={INPUT}
						value={Math.round(selectedElement.rotation || 0)}
						onChange={(e) => onUpdateElement({ rotation: Number(e.target.value) })}
					/>
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-muted-foreground'>Opacity</span>
					<input
						type='range'
						disabled={!canEdit}
						min={0}
						max={100}
						value={Math.round((selectedElement.opacity ?? 1) * 100)}
						className='accent-primary'
						onChange={(e) => onUpdateElement({ opacity: Number(e.target.value) / 100 })}
					/>
				</label>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Layer Order Buttons
// ---------------------------------------------------------------------------

interface LayerOrderButtonsProps {
	canEdit: boolean;
	onMoveLayer: (direction: 'forward' | 'backward') => void;
}

export function LayerOrderButtons({
	canEdit,
	onMoveLayer,
}: LayerOrderButtonsProps): React.ReactElement {
	return (
		<div className='flex gap-1'>
			<button
				type='button'
				className={cn('flex-1', BTN)}
				disabled={!canEdit}
				onClick={() => onMoveLayer('forward')}
			>
				↑ Forward
			</button>
			<button
				type='button'
				className={cn('flex-1', BTN)}
				disabled={!canEdit}
				onClick={() => onMoveLayer('backward')}
			>
				↓ Backward
			</button>
		</div>
	);
}
