import React from 'react';

// ── Props ─────────────────────────────────────────────────────────────────────

interface SmartArtNodeStyleBarProps {
	/** Resolved palette colours (hex strings) to offer as fill choices. */
	palette: string[];
	/** Called with the chosen hex colour when the user clicks a swatch. */
	onPickFill: (color: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A floating row of colour swatches for quickly picking a per-node fill colour.
 *
 * Rendered absolutely above the hovered SmartArt node by
 * {@link SmartArtEditableLayer} when both `palette` and `onChangeNodeStyle`
 * props are supplied and there is no inline text editor open.
 *
 * Mouse events are stopped so the swatch bar does not accidentally trigger
 * drag / selection on the parent SmartArt element.
 */
export function SmartArtNodeStyleBar({
	palette,
	onPickFill,
}: SmartArtNodeStyleBarProps): React.ReactElement {
	return (
		<div
			className='flex gap-1 px-1.5 py-1 bg-white/90 shadow-sm rounded-full border border-border'
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
		>
			{palette.slice(0, 6).map((color) => (
				<button
					key={color}
					type='button'
					aria-label={`Set fill to ${color}`}
					className='w-3.5 h-3.5 rounded-full border border-black/10 hover:scale-125 transition-transform'
					style={{ background: color }}
					onClick={() => onPickFill(color)}
				/>
			))}
		</div>
	);
}
