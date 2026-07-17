import type { ThemeCatalogEntry } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../utils';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SettingsAppearanceTabProps {
	/** Key of the currently active catalog entry (`'default'` when unset). */
	activeThemeKey: string;
	/** Catalog to render swatches for: `THEME_CATALOG` unless the host supplied `availableThemes`. */
	themes: readonly ThemeCatalogEntry[];
	onSelectTheme: (key: string) => void;
}

/** File > Options > Appearance: a swatch gallery over the shared theme catalog. */
export function SettingsAppearanceTab({
	activeThemeKey,
	themes,
	onSelectTheme,
}: SettingsAppearanceTabProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<div className='grid grid-cols-2 gap-3'>
			{themes.map((entry) => {
				const isActive = entry.key === activeThemeKey;
				const previewBackground = entry.theme?.colors?.background ?? '#0b0f19';
				const previewPrimary = entry.theme?.colors?.primary ?? '#6366f1';
				return (
					<button
						key={entry.key}
						type='button'
						onClick={() => onSelectTheme(entry.key)}
						aria-pressed={isActive}
						className={cn(
							'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
							isActive
								? 'border-primary bg-primary/10'
								: 'border-border hover:border-primary/50 hover:bg-accent',
						)}
					>
						<span
							className='h-8 w-8 shrink-0 rounded-full border border-border/60 shadow-inner'
							style={{
								background: `linear-gradient(135deg, ${previewBackground} 50%, ${previewPrimary} 50%)`,
							}}
						/>
						<span
							className={cn('text-xs font-medium', isActive ? 'text-primary' : 'text-foreground')}
						>
							{t(entry.labelKey)}
						</span>
					</button>
				);
			})}
		</div>
	);
}
