import type { PptxSmartArtNodeStyle } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { INPUT } from './inspector-pane-constants';
import { SmartArtNodeStyleControls } from './SmartArtNodeStyleControls';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SmartArtNodeRowProps {
	nodeId: string;
	text: string;
	/** 1-based display index for top-level nodes. */
	displayIndex: number;
	isChild: boolean;
	canEdit: boolean;
	/** Disable the remove control (e.g. layout min reached or last node). */
	removeDisabled: boolean;
	/** Disable move-up (already first among siblings). */
	moveUpDisabled: boolean;
	/** Disable move-down (already last among siblings). */
	moveDownDisabled: boolean;
	/** Ref callback so the parent can focus the input after structural edits. */
	inputRef: (el: HTMLInputElement | null) => void;
	/** Current per-node visual override (fill / font colour, bold / italic). */
	style?: PptxSmartArtNodeStyle;
	onChangeText: (nodeId: string, text: string) => void;
	onKeyDown: (e: React.KeyboardEvent, nodeId: string) => void;
	onAddSubItem: (nodeId: string) => void;
	onMoveUp: (nodeId: string) => void;
	onMoveDown: (nodeId: string) => void;
	onRemove: (nodeId: string) => void;
	/** Apply a partial per-node style change (routed to setSmartArtNodeStyle). */
	onChangeStyle: (nodeId: string, patch: Partial<PptxSmartArtNodeStyle>) => void;
}

const MINI_BTN =
	'text-[9px] text-muted-foreground hover:text-primary px-1 disabled:opacity-40 disabled:cursor-not-allowed';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A single editable SmartArt node row in the text pane.
 *
 * Purely presentational: all mutations are routed back through callbacks so the
 * editing logic stays in the parent / core ops.
 */
export function SmartArtNodeRow({
	nodeId,
	text,
	displayIndex,
	isChild,
	canEdit,
	removeDisabled,
	moveUpDisabled,
	moveDownDisabled,
	inputRef,
	style,
	onChangeText,
	onKeyDown,
	onAddSubItem,
	onMoveUp,
	onMoveDown,
	onRemove,
	onChangeStyle,
}: SmartArtNodeRowProps): React.ReactElement {
	const { t } = useTranslation();
	const label = isChild
		? `Sub-item: ${text || 'empty'}`
		: `Item ${displayIndex}: ${text || 'empty'}`;

	return (
		<div
			role='listitem'
			className={cn(
				'rounded border bg-background/60 p-1.5',
				isChild ? 'border-border/60 ml-4' : 'border-border',
			)}
		>
			<div className='flex items-center gap-1'>
				<span className='text-[9px] text-muted-foreground w-3 shrink-0' aria-hidden='true'>
					{isChild ? '•' : `${displayIndex}`}
				</span>
				<input
					ref={inputRef}
					type='text'
					data-testid='smartart-node-text'
					disabled={!canEdit}
					aria-label={label}
					className={cn(INPUT, 'flex-1 text-[11px] py-0.5')}
					value={text}
					onChange={(e) => onChangeText(nodeId, e.target.value)}
					onKeyDown={(e) => onKeyDown(e, nodeId)}
					placeholder={t('pptx.smartArt.nodePlaceholder')}
				/>
				<div className='flex items-center gap-0.5 shrink-0'>
					<button
						type='button'
						disabled={!canEdit || moveUpDisabled}
						className={MINI_BTN}
						onClick={() => onMoveUp(nodeId)}
						aria-label={`Move ${label} up`}
						title={t('pptx.smartArt.moveUp')}
					>
						↑
					</button>
					<button
						type='button'
						disabled={!canEdit || moveDownDisabled}
						className={MINI_BTN}
						onClick={() => onMoveDown(nodeId)}
						aria-label={`Move ${label} down`}
						title={t('pptx.smartArt.moveDown')}
					>
						↓
					</button>
					{!isChild && (
						<button
							type='button'
							disabled={!canEdit}
							className={MINI_BTN}
							onClick={() => onAddSubItem(nodeId)}
							aria-label={`Add sub-item under ${label}`}
							title={t('pptx.smartArt.addSubItem')}
						>
							+Sub
						</button>
					)}
					<button
						type='button'
						disabled={!canEdit || removeDisabled}
						className={cn(MINI_BTN, 'hover:text-red-400')}
						onClick={() => onRemove(nodeId)}
						aria-label={`Remove ${label}`}
						title={removeDisabled ? t('pptx.smartArt.layoutMinimum') : t('pptx.smartArt.remove')}
					>
						x
					</button>
				</div>
			</div>
			<SmartArtNodeStyleControls
				nodeId={nodeId}
				style={style}
				label={label}
				canEdit={canEdit}
				onChangeStyle={onChangeStyle}
			/>
		</div>
	);
}
