import type { ToolbarTabId, ViewerOptions } from 'pptx-viewer-shared';
import { SHORTCUT_REFERENCE_ITEMS, TOOLBAR_TABS } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';

export interface OptionsRibbonPaneProps {
	options: ViewerOptions;
	onRibbonTabHiddenChange: (tabId: ToolbarTabId, hidden: boolean) => void;
	onResetRibbon: () => void;
}

/**
 * Options > Customize Ribbon: PowerPoint's "Main Tabs" checkbox tree over the
 * shared `TOOLBAR_TABS` registry, plus the keyboard-shortcut reference that
 * PowerPoint keeps behind "Keyboard shortcuts: Customize".
 */
export function OptionsRibbonPane({
	options,
	onRibbonTabHiddenChange,
	onResetRibbon,
}: OptionsRibbonPaneProps): React.ReactElement {
	const { t } = useTranslation();
	const hidden = new Set(options.ribbon.hiddenTabIds);

	return (
		<div className='space-y-5'>
			<section>
				<h3 className='mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
					{t('pptx.options.ribbon.tabsTitle')}
				</h3>
				<p className='mb-2 text-xs text-muted-foreground'>
					{t('pptx.options.ribbon.tabsDescription')}
				</p>
				<div className='space-y-0.5 rounded border border-border/60 p-2'>
					{TOOLBAR_TABS.map((tab) => {
						const isFile = tab.id === 'file';
						const isVisible = isFile || !hidden.has(tab.id);
						return (
							<label
								key={tab.id}
								className={cn(
									'flex items-center gap-2 rounded px-2 py-1.5',
									isFile ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-accent',
								)}
							>
								<input
									type='checkbox'
									className='h-4 w-4 accent-[var(--pptx-primary,#6366f1)]'
									checked={isVisible}
									disabled={isFile}
									onChange={(event) => onRibbonTabHiddenChange(tab.id, !event.target.checked)}
								/>
								<span className='text-sm text-foreground'>{t(tab.labelKey)}</span>
							</label>
						);
					})}
				</div>
				<button
					type='button'
					onClick={onResetRibbon}
					className='mt-2 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent'
				>
					{t('pptx.options.ribbon.reset')}
				</button>
			</section>

			<section>
				<h3 className='mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
					{t('pptx.settings.keyboardShortcuts')}
				</h3>
				<div className='space-y-0.5'>
					{SHORTCUT_REFERENCE_ITEMS.map((shortcut, i) => (
						<div
							key={shortcut.actionKey}
							className={cn(
								'flex items-center justify-between gap-3 rounded px-3 py-2',
								i % 2 === 0 ? 'bg-muted/60' : '',
							)}
						>
							<span className='text-xs text-foreground'>{t(shortcut.actionKey)}</span>
							<span className='whitespace-nowrap font-mono text-[11px] text-muted-foreground'>
								{shortcut.shortcut}
							</span>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
