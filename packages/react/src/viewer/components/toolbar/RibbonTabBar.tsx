import type { RibbonContextualTabId } from 'pptx-viewer-shared';
import {
	RIBBON_CONTEXTUAL_TAB_ATTR,
	contextualTabLabelKey,
	resolveScreenTip,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { TOOLBAR_SECTIONS } from '../../constants';
import type { ToolbarSection } from '../../types';
import { cn } from '../../utils';
import { useViewerOptionsContext } from '../viewer-options-context';

export interface RibbonTabBarProps {
	isTabVisible: (id: ToolbarSection) => boolean;
	/** The fixed tab shown, or null while a contextual tab is. */
	activeSection: ToolbarSection | null;
	contextualTabs: readonly RibbonContextualTabId[];
	activeContextual: RibbonContextualTabId | null;
	onSelectSection: (id: ToolbarSection) => void;
	onSelectContextual: (id: RibbonContextualTabId) => void;
	/** Right-side tab-row content (Record / Share, the compact toggle). */
	children?: React.ReactNode;
}

const TAB_BASE =
	'relative px-3.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors max-md:min-h-[36px] max-md:px-3';
const TAB_UNDERLINE =
	'after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary';

/**
 * The ribbon tab row: the fixed tabs, then the contextual tabs the selection
 * brings up (PowerPoint's Shape Format, Picture Format, ...), drawn in the
 * accent colour so they read as selection-scoped.
 */
export function RibbonTabBar(p: RibbonTabBarProps): React.ReactElement {
	const { t } = useTranslation();
	const viewerOptions = useViewerOptionsContext();
	return (
		<div
			role='tablist'
			className='flex items-center border-b border-border/60 px-1 max-md:overflow-x-auto max-md:scrollbar-none'
		>
			{TOOLBAR_SECTIONS.filter((s) => p.isTabVisible(s.id)).map((s) => {
				const selected = p.activeSection === s.id;
				return (
					<button
						key={s.id}
						type='button'
						role='tab'
						aria-selected={selected}
						title={resolveScreenTip(viewerOptions, t(s.labelKey))}
						onClick={() => p.onSelectSection(s.id)}
						className={cn(
							TAB_BASE,
							selected
								? s.id === 'file'
									? 'text-white bg-primary/80 rounded-sm'
									: `text-foreground ${TAB_UNDERLINE}`
								: s.id === 'file'
									? 'text-primary hover:bg-primary/15 rounded-sm'
									: 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
						)}
					>
						{t(s.labelKey)}
					</button>
				);
			})}
			{p.contextualTabs.map((id) => {
				const selected = p.activeContextual === id;
				const label = t(contextualTabLabelKey(id));
				return (
					<button
						key={id}
						type='button'
						role='tab'
						aria-selected={selected}
						{...{ [RIBBON_CONTEXTUAL_TAB_ATTR]: id }}
						title={resolveScreenTip(viewerOptions, label)}
						onClick={() => p.onSelectContextual(id)}
						className={cn(
							TAB_BASE,
							'text-primary',
							selected ? TAB_UNDERLINE : 'hover:bg-primary/10',
						)}
					>
						{label}
					</button>
				);
			})}
			<div className='flex-1' />
			{p.children}
		</div>
	);
}
