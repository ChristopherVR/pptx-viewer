import type {
	PptxPresentationProperties,
	PptxCoreProperties,
	PptxAppProperties,
	PptxCustomProperty,
	PptxThemeOption,
	PptxTheme,
	PptxSlide,
	PptxSlideTransition,
	PptxNotesMaster,
	PptxHandoutMaster,
	PptxTagCollection,
} from 'pptx-viewer-core';
import type { SlideSizeEmu, SlideSizeRescaleMode } from 'pptx-viewer-shared';
import { mergeSlideTransition } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../../types';
import { cn } from '../../utils';
import { NotesHandoutCard, DocumentPropertiesCard } from './DocumentPropertiesCards';
import { CARD, HEADING } from './inspector-pane-constants';
import {
	PresentationSettingsCard,
	ThemeSelectorCard,
	SlideSizeCard,
} from './PresentationSettingsCards';
import { SlideThemeOverridePanel } from './SlideThemeOverridePanel';
import { SlideTransitionSection } from './SlideTransitionSection';
import { TagsSection } from './TagsSection';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PresentationPropertiesPanelProps {
	presentationProperties: PptxPresentationProperties;
	canEdit: boolean;
	onUpdatePresentationProperties: (patch: Partial<PptxPresentationProperties>) => void;

	themeOptions: PptxThemeOption[];
	selectedThemePath: string;
	setSelectedThemePath: (path: string) => void;
	onApplyTheme: (path: string, allMasters: boolean) => void;

	activeSlide: PptxSlide | undefined;
	theme: PptxTheme | undefined;
	onUpdateSlide: (patch: Partial<PptxSlide>) => void;

	canvasSize: CanvasSize;
	onUpdateCanvasSize: (size: CanvasSize) => void;
	/** The deck's `p:sldSz` in EMU, so the card can name the matching preset. */
	slideSizeEmu?: SlideSizeEmu | undefined;
	onUpdateSlideSize?: (size: SlideSizeEmu, rescaleMode?: SlideSizeRescaleMode) => void;
	/** Whether any slide has at least one element; gates the rescale prompt. */
	hasContent: boolean;

	notesCanvasSize: CanvasSize | undefined;
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;

	coreProperties: PptxCoreProperties | undefined;
	onUpdateCoreProperties: (patch: Partial<PptxCoreProperties>) => void;
	appProperties: PptxAppProperties | undefined;
	onUpdateAppProperties: (patch: Partial<PptxAppProperties>) => void;
	customProperties: PptxCustomProperty[];
	onUpdateCustomProperties: (props: PptxCustomProperty[]) => void;

	tagCollections: PptxTagCollection[] | undefined;
	onUpdateTagCollections: ((tags: PptxTagCollection[]) => void) | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationPropertiesPanel({
	presentationProperties,
	canEdit,
	onUpdatePresentationProperties,
	themeOptions,
	selectedThemePath,
	setSelectedThemePath,
	onApplyTheme,
	activeSlide,
	theme,
	onUpdateSlide,
	canvasSize,
	onUpdateCanvasSize,
	slideSizeEmu,
	onUpdateSlideSize,
	hasContent,
	notesCanvasSize,
	notesMaster,
	handoutMaster,
	coreProperties,
	onUpdateCoreProperties,
	appProperties,
	onUpdateAppProperties,
	customProperties,
	onUpdateCustomProperties,
	tagCollections,
	onUpdateTagCollections,
}: PresentationPropertiesPanelProps): React.ReactElement {
	const { t } = useTranslation();

	// A transition is a single OOXML element edited one attribute at a time, so
	// every change MERGES onto whatever the slide already carries (shared
	// `mergeSlideTransition`). Replacing it wholesale is the bug this avoids:
	// retiming the transition would silently discard an authored sound,
	// direction or spoke count that came out of the deck.
	const handleTransitionChange = React.useCallback(
		(updates: Partial<PptxSlideTransition>) => {
			onUpdateSlide({
				transition: mergeSlideTransition(activeSlide?.transition, updates),
			});
		},
		[activeSlide?.transition, onUpdateSlide],
	);

	return (
		<div className='space-y-3'>
			<PresentationSettingsCard
				presentationProperties={presentationProperties}
				canEdit={canEdit}
				onUpdate={onUpdatePresentationProperties}
			/>

			<ThemeSelectorCard
				themeOptions={themeOptions}
				selectedThemePath={selectedThemePath}
				setSelectedThemePath={setSelectedThemePath}
				canEdit={canEdit}
				onApplyTheme={onApplyTheme}
			/>

			<div className={CARD}>
				<div className={HEADING}>{t('pptx.themeOverride.heading')}</div>
				<SlideThemeOverridePanel
					activeSlide={activeSlide}
					theme={theme}
					canEdit={canEdit}
					onUpdateSlide={onUpdateSlide}
				/>
			</div>

			<SlideSizeCard
				canvasSize={canvasSize}
				slideSizeEmu={slideSizeEmu}
				canEdit={canEdit}
				onUpdate={onUpdateCanvasSize}
				onUpdateSlideSize={onUpdateSlideSize}
				hasContent={hasContent}
			/>

			{/* SLIDE TRANSITION sits beside SLIDE SIZE, matching where Angular,
			    Svelte and Vanilla place it in their deck-properties panes. */}
			<SlideTransitionSection
				activeSlide={activeSlide ?? null}
				canEdit={canEdit}
				onTransitionChange={handleTransitionChange}
			/>

			<NotesHandoutCard
				notesCanvasSize={notesCanvasSize}
				notesMaster={notesMaster}
				handoutMaster={handoutMaster}
			/>

			<DocumentPropertiesCard
				coreProperties={coreProperties}
				appProperties={appProperties}
				customProperties={customProperties}
				canEdit={canEdit}
				onUpdateCoreProperties={onUpdateCoreProperties}
				onUpdateAppProperties={onUpdateAppProperties}
				onUpdateCustomProperties={onUpdateCustomProperties}
			/>

			{tagCollections && onUpdateTagCollections && (
				<TagsSection
					tagCollections={tagCollections}
					onUpdateTagCollections={onUpdateTagCollections}
					canEdit={canEdit}
				/>
			)}

			{activeSlide && (
				<div className={cn(CARD, 'space-y-1')}>
					<div className={HEADING}>Slide</div>
					<div className='text-[11px] text-muted-foreground'>
						{activeSlide.elements?.length ?? 0} elements
					</div>
				</div>
			)}
		</div>
	);
}
