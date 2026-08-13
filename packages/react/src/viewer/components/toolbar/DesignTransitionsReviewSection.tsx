import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuMonitor, LuPaintBucket, LuPalette, LuPencil } from 'react-icons/lu';

import { cn } from '../../utils';
import { ics, pill, sep } from './toolbar-constants';

/* ── Design ────────────────────────────────────────────── */

export interface DesignSectionProps {
	canEdit: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onOpenDocumentProperties?: () => void;
	onToggleInspector?: () => void;
	isInspectorPaneOpen?: boolean;
}

export function DesignSection(p: DesignSectionProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<>
			{/* Themes */}
			<button
				onClick={p.onToggleThemeGallery}
				disabled={!p.canEdit}
				className={cn(
					pill,
					p.isThemeGalleryOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
				)}
				title={t('pptx.ribbon.browseThemesTitle')}
			>
				<LuPalette className={ics} />
				{t('pptx.ribbon.browseThemes')}
			</button>
			<button
				onClick={p.onToggleThemeEditor}
				disabled={!p.canEdit}
				className={cn(pill, p.isThemeEditorOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')}
				title={t('pptx.ribbon.editThemeTitle')}
			>
				<LuPencil className={ics} />
				{t('pptx.ribbon.editTheme')}
			</button>

			{sep}

			{/* Customize */}
			{p.onOpenDocumentProperties && (
				<button
					onClick={p.onOpenDocumentProperties}
					className={pill}
					title={t('pptx.ribbon.slideSizeTitle')}
				>
					<LuMonitor className={ics} />
					{t('pptx.ribbon.slideSize')}
				</button>
			)}
			{p.onToggleInspector && (
				<button
					onClick={p.onToggleInspector}
					className={cn(
						pill,
						p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
					)}
					title={t('pptx.ribbon.formatBackgroundTitle')}
				>
					<LuPaintBucket className={ics} />
					{t('pptx.ribbon.formatBackground')}
				</button>
			)}
		</>
	);
}

/* ── Transitions ───────────────────────────── */

// The Transitions tab moved into its own module when it stopped being mock UI:
// it now reads the active slide and commits through the shared
// `ribbon-transitions` decision function, which does not fit inside this file's
// 300-line budget alongside Design. Re-exported here so the existing import
// sites keep working.
export { TransitionsSection } from './TransitionsSection';
export type { TransitionsSectionProps } from './TransitionsSection';
