import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { cn } from '../utils';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SettingsLanguageTabProps {
	activeLocale: string;
	/** Locales resolved from the host's registered i18n resources (falls back to `LOCALE_CATALOG`). */
	locales: readonly LocaleCatalogEntry[];
	onSelectLocale: (code: string) => void;
}

/** File > Options > Language: a simple list over the resolved locale catalog. */
export function SettingsLanguageTab({
	activeLocale,
	locales,
	onSelectLocale,
}: SettingsLanguageTabProps): React.ReactElement {
	return (
		<div className='space-y-0.5'>
			{locales.map((locale) => {
				const isActive = locale.code === activeLocale;
				return (
					<button
						key={locale.code}
						type='button'
						onClick={() => onSelectLocale(locale.code)}
						aria-pressed={isActive}
						className={cn(
							'flex w-full items-center justify-between rounded px-3 py-2.5 text-left transition-colors',
							isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
						)}
					>
						<span className='text-sm'>{locale.nativeLabel}</span>
						{locale.nativeLabel !== locale.label && (
							<span className='text-xs text-muted-foreground'>{locale.label}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
