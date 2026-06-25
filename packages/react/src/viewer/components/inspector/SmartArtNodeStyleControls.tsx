import type { PptxSmartArtNodeStyle } from 'pptx-viewer-core';
import React from 'react';

import { cn } from '../../utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SmartArtNodeStyleControlsProps {
	/** The node id these controls mutate. */
	nodeId: string;
	/** Current per-node style override (undefined when none is set). */
	style: PptxSmartArtNodeStyle | undefined;
	/** Accessible label prefix (e.g. "Item 1: Foo") so controls are unambiguous. */
	label: string;
	/** Whether editing is permitted. */
	canEdit: boolean;
	/** Apply a partial style change for the node (routed to setSmartArtNodeStyle). */
	onChangeStyle: (nodeId: string, patch: Partial<PptxSmartArtNodeStyle>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallbacks shown in the colour swatches when a node has no explicit override. */
const DEFAULT_FILL = '#3b82f6';
const DEFAULT_FONT = '#ffffff';

const EMPHASIS_BTN =
	'px-1.5 py-0.5 text-[10px] rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Per-node style controls (fill colour, font colour, bold, italic) for a single
 * SmartArt node. Purely presentational: every change is routed through
 * `onChangeStyle`, which the panel wires to `setSmartArtNodeStyle` + the
 * element-update path so undo / redo and round-trip persistence work.
 */
export function SmartArtNodeStyleControls({
	nodeId,
	style,
	label,
	canEdit,
	onChangeStyle,
}: SmartArtNodeStyleControlsProps): React.ReactElement {
	const bold = Boolean(style?.bold);
	const italic = Boolean(style?.italic);

	return (
		<div
			className='flex items-center gap-1.5 mt-1 pl-4'
			role='group'
			aria-label={`Style for ${label}`}
		>
			<label className='flex items-center gap-0.5 text-[9px] text-muted-foreground'>
				<span>Fill</span>
				<input
					type='color'
					disabled={!canEdit}
					aria-label={`Fill colour for ${label}`}
					className='h-4 w-5 cursor-pointer rounded border border-border bg-transparent p-0 disabled:cursor-not-allowed'
					value={style?.fillColor ?? DEFAULT_FILL}
					onChange={(e) => onChangeStyle(nodeId, { fillColor: e.target.value })}
				/>
			</label>
			<label className='flex items-center gap-0.5 text-[9px] text-muted-foreground'>
				<span>Text</span>
				<input
					type='color'
					disabled={!canEdit}
					aria-label={`Font colour for ${label}`}
					className='h-4 w-5 cursor-pointer rounded border border-border bg-transparent p-0 disabled:cursor-not-allowed'
					value={style?.fontColor ?? DEFAULT_FONT}
					onChange={(e) => onChangeStyle(nodeId, { fontColor: e.target.value })}
				/>
			</label>
			<button
				type='button'
				disabled={!canEdit}
				aria-label={`Bold ${label}`}
				aria-pressed={bold}
				className={cn(
					EMPHASIS_BTN,
					'font-bold',
					bold
						? 'border-primary bg-primary/20 text-primary'
						: 'border-border text-muted-foreground',
				)}
				onClick={() => onChangeStyle(nodeId, { bold: !bold })}
			>
				B
			</button>
			<button
				type='button'
				disabled={!canEdit}
				aria-label={`Italic ${label}`}
				aria-pressed={italic}
				className={cn(
					EMPHASIS_BTN,
					'italic',
					italic
						? 'border-primary bg-primary/20 text-primary'
						: 'border-border text-muted-foreground',
				)}
				onClick={() => onChangeStyle(nodeId, { italic: !italic })}
			>
				I
			</button>
		</div>
	);
}
