import type { TextStyle } from 'pptx-viewer-core';
import { TEXT_WARP_PRESETS, warpPreviewPath } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

// The warp preset catalogue + preview-path generator now live in
// `pptx-viewer-shared` (consumed identically by Vue and Angular). Re-export them
// here to preserve this module's historical public symbol surface.
export { TEXT_WARP_PRESETS, warpPreviewPath };

// ==========================================================================
// Component
// ==========================================================================

interface TextWarpGalleryProps {
	ts: TextStyle | undefined;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

export function TextWarpGallery({
	ts,
	onUpdateTextStyle,
}: TextWarpGalleryProps): React.ReactElement {
	const { t } = useTranslation();
	const [expanded, setExpanded] = React.useState(false);
	const currentPreset = ts?.textWarpPreset || 'textNoShape';

	return (
		<div className='mt-2 rounded border border-border bg-card p-2 space-y-2'>
			<button
				type='button'
				className='flex w-full items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground'
				onClick={() => setExpanded(!expanded)}
			>
				<span>{t('pptx.textWarp.title')}</span>
				<span className='text-muted-foreground'>{expanded ? '−' : '+'}</span>
			</button>
			{!expanded && (
				<div className='text-[11px] text-muted-foreground'>
					{TEXT_WARP_PRESETS.find((p) => p.value === currentPreset)?.label || currentPreset}
				</div>
			)}
			{expanded && (
				<div className='grid grid-cols-5 gap-1'>
					{TEXT_WARP_PRESETS.map(({ value, label }) => (
						<button
							key={value}
							type='button'
							title={label}
							aria-label={label}
							className={`flex items-center justify-center rounded p-1 ${currentPreset === value ? 'bg-primary ring-1 ring-primary' : 'bg-muted hover:bg-accent'}`}
							onClick={() =>
								onUpdateTextStyle({
									textWarpPreset: value === 'textNoShape' ? undefined : value,
								})
							}
						>
							<svg width={40} height={20} viewBox='0 0 40 20'>
								<path
									d={warpPreviewPath(value)}
									stroke='currentColor'
									strokeWidth={1.5}
									fill='none'
									className={currentPreset === value ? 'text-white' : 'text-muted-foreground'}
								/>
							</svg>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
