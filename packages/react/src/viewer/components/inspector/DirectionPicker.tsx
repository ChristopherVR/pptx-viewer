import { buildDirectionGrid, TRANSITION_DIR_ARROWS } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Arrow labels for direction tokens. The table itself now lives in
 * `pptx-viewer-shared` (every binding's direction picker draws the same
 * glyphs); re-exported here for the React package's historical symbol surface.
 */
export const DIR_ARROWS: Readonly<Record<string, string>> = TRANSITION_DIR_ARROWS;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DirectionPickerProps {
	directions: readonly string[];
	value: string | undefined;
	/** Greys the grid out when the viewer is not editable. */
	disabled?: boolean;
	onChange: (dir: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DirectionPicker({
	directions,
	value,
	disabled,
	onChange,
}: DirectionPickerProps): React.ReactElement {
	const { t } = useTranslation();

	if (directions.length <= 3) {
		return (
			<div className='flex gap-1'>
				{directions.map((dir) => (
					<button
						key={dir}
						type='button'
						disabled={disabled}
						onClick={() => onChange(dir)}
						className={`px-2 py-1 rounded text-xs border ${
							value === dir
								? 'bg-primary text-white border-primary'
								: 'bg-muted border-border hover:bg-accent'
						}`}
						title={t(`pptx.transition.dir.${dir}`, dir)}
					>
						{DIR_ARROWS[dir] ?? dir}
					</button>
				))}
			</div>
		);
	}

	const cells = buildDirectionGrid(directions);

	return (
		<div className='inline-grid grid-cols-3 gap-0.5'>
			{cells.flatMap((row, ri) =>
				row.map((cell, ci) => {
					if (!cell) {
						return <div key={`${ri}-${ci}`} className='w-6 h-6' />;
					}
					return (
						<button
							key={cell}
							type='button'
							disabled={disabled}
							onClick={() => onChange(cell)}
							className={`w-6 h-6 rounded text-xs flex items-center justify-center border ${
								value === cell
									? 'bg-primary text-white border-primary'
									: 'bg-muted border-border hover:bg-accent'
							}`}
							title={t(`pptx.transition.dir.${cell}`, cell)}
						>
							{DIR_ARROWS[cell] ?? cell}
						</button>
					);
				}),
			)}
		</div>
	);
}
