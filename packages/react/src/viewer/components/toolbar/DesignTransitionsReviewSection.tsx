import { FIXED_TAB_GALLERIES } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuMonitor, LuPaintBucket, LuPalette, LuPencil, LuType } from 'react-icons/lu';

import { cn } from '../../utils';
import { controlAttr, groupAttr, RibbonGroupScope } from './PowerPointRibbonControls';
import { RibbonGallery } from './RibbonGallery';
import { ics, pill, sep } from './toolbar-constants';

/** Design > Variants' galleries (Colors, Fonts), in ribbon order. */
const DESIGN_VARIANT_GALLERIES = FIXED_TAB_GALLERIES.filter((placement) =>
	placement.control.startsWith('design.variants.'),
);

/* ── Design ────────────────────────────────────────────── */

export interface DesignSectionProps {
	canEdit: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onOpenDocumentProperties?: () => void;
	/**
	 * Design > Slide Size: reveal the inspector's SLIDE SIZE card, the only
	 * slide-size control this binding has. The button used to run
	 * `onOpenDocumentProperties`, a dialog with no slide-size control in it -
	 * the same mis-wiring Angular, Vanilla and Svelte each shipped separately.
	 */
	onOpenSlideSize?: () => void;
	onToggleInspector?: () => void;
	isInspectorPaneOpen?: boolean;
}

export function DesignSection(p: DesignSectionProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<>
			{/* Themes */}
			<RibbonGroupScope id='design.themes'>
				<button
					onClick={p.onToggleThemeGallery}
					disabled={!p.canEdit}
					className={cn(
						pill,
						p.isThemeGalleryOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
					)}
					title={t('pptx.ribbon.browseThemesTitle')}
					{...controlAttr('design.themes.browseThemes')}
				>
					<LuPalette className={ics} />
					{t('pptx.ribbon.browseThemes')}
				</button>
				<button
					onClick={p.onToggleThemeEditor}
					disabled={!p.canEdit}
					className={cn(
						pill,
						p.isThemeEditorOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
					)}
					title={t('pptx.ribbon.editThemeTitle')}
					{...controlAttr('design.themes.editTheme')}
				>
					<LuPencil className={ics} />
					{t('pptx.ribbon.editTheme')}
				</button>
			</RibbonGroupScope>

			{sep}

			{/* Variants: the shared theme Colors / Fonts galleries */}
			<div className='flex flex-col items-center gap-0.5' {...groupAttr('design.variants')}>
				<div className='flex items-center gap-1'>
					{DESIGN_VARIANT_GALLERIES.map((placement) => (
						<RibbonGallery
							key={placement.control}
							placement={placement}
							icon={
								placement.gallery === 'themeFonts' ? (
									<LuType className={ics} />
								) : (
									<LuPalette className={ics} />
								)
							}
						/>
					))}
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.ribbon.groupVariants')}
				</span>
			</div>

			{sep}

			{/* Customize */}
			<RibbonGroupScope id='design.customize'>
				{(p.onOpenSlideSize ?? p.onOpenDocumentProperties) && (
					<button
						onClick={p.onOpenSlideSize ?? p.onOpenDocumentProperties}
						className={pill}
						title={t('pptx.ribbon.slideSizeTitle')}
						{...controlAttr('design.customize.slideSize')}
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
						{...controlAttr('design.customize.formatBackground')}
					>
						<LuPaintBucket className={ics} />
						{t('pptx.ribbon.formatBackground')}
					</button>
				)}
			</RibbonGroupScope>
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
