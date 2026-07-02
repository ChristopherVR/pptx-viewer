import type { PptxImageLikeElement } from 'pptx-viewer-core';
import { ARTISTIC_EFFECTS } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';

// ---------------------------------------------------------------------------
// Artistic effect presets
// ---------------------------------------------------------------------------

export { ARTISTIC_EFFECTS };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArtisticGalleryProps {
	imgSrc: string | undefined;
	fx: PptxImageLikeElement['imageEffects'];
	canEdit: boolean;
	updateEffects: (patch: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Gallery grid
// ---------------------------------------------------------------------------

export function ArtisticEffectsGallery({
	imgSrc,
	fx,
	canEdit,
	updateEffects,
}: ArtisticGalleryProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='space-y-1 text-[11px]'>
			<span className='text-muted-foreground'>{t('pptx.image.artisticEffects')}</span>
			<div className='grid grid-cols-4 gap-1'>
				{ARTISTIC_EFFECTS.map(([effectName, tKey, cssFilter]) => {
					const isActive =
						effectName === 'none' ? !fx?.artisticEffect : fx?.artisticEffect === effectName;
					return (
						<button
							key={effectName}
							type='button'
							disabled={!canEdit}
							className={cn(
								'flex flex-col items-center gap-0.5 rounded border p-0.5 hover:bg-accent/50',
								isActive ? 'border-primary bg-primary/10' : 'border-border',
							)}
							title={t(tKey)}
							onClick={() =>
								updateEffects({
									artisticEffect: effectName === 'none' ? undefined : effectName,
									...(effectName === 'grayscale' ? { grayscale: undefined } : {}),
								})
							}
						>
							<div
								className='w-10 h-7 rounded overflow-hidden bg-muted'
								style={{
									backgroundImage: imgSrc ? `url(${imgSrc})` : undefined,
									backgroundSize: 'cover',
									backgroundPosition: 'center',
									filter: cssFilter || undefined,
								}}
							/>
							<span className='text-[8px] text-muted-foreground truncate w-full text-center'>
								{t(tKey)}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
