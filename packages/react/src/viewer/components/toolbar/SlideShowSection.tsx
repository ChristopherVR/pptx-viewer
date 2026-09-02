import type { PptxPresentationProperties } from 'pptx-viewer-core';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import { SLIDE_SHOW_OPTIONS, readSlideShowOption, slideShowOptionChange } from 'pptx-viewer-shared';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuCaptions,
	LuCast,
	LuClock3,
	LuEyeOff,
	LuListVideo,
	LuMonitorPlay,
	LuPlay,
	LuPresentation,
	LuSettings2,
	LuVideo,
} from 'react-icons/lu';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import type { ViewerMode } from '../../types';
import { CustomShowsControls } from './CustomShowsControls';
import type { CustomShowsControlsProps } from './CustomShowsControls';
import {
	RibbonCommand,
	RibbonCommandStack,
	RibbonGroup,
	RibbonToggle,
} from './PowerPointRibbonControls';
import { RibbonMenu } from './RibbonMenu';

export interface SlideShowSectionProps {
	onPresent: () => void;
	/**
	 * "From Beginning": enters the show on its first slide regardless of the
	 * active slide. Falls back to `onSetMode('present')` when omitted.
	 */
	onPresentFromBeginning?: () => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSetUpSlideShow: () => void;
	/**
	 * PowerPoint's Hide Slide toggle: marks the ACTIVE slide to be skipped during
	 * the show while leaving it in the deck, the thumbnail rail and the sorter.
	 */
	onToggleHideSlide: () => void;
	/** Whether the active slide is currently hidden, for the toggle's pressed state. */
	activeSlideHidden: boolean;
	onOpenBroadcastDialog: () => void;
	onToggleSubtitles: () => void;
	showSubtitles: boolean;
	onSetMode: (mode: ViewerMode) => void;
	/**
	 * Everything the custom-show picker needs. `ToolbarProps` is a superset of
	 * this (it is a `Pick` of it), so callers hand their whole props object over
	 * rather than re-listing nine fields at every call site.
	 */
	customShowControls: CustomShowsControlsProps;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
	/** Deck presentation properties backing the Options checkboxes. */
	presentationProperties?: PptxPresentationProperties;
	/** Commit an Options checkbox onto the deck's presentation properties. */
	onPresentationPropertiesChange?: (updates: Partial<PptxPresentationProperties>) => void;
}

export function SlideShowSection(p: SlideShowSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const { isHidden } = useToolbarVisibility(p.hiddenActions);
	// The Custom Show command used to render disabled with no handler at all,
	// while Vanilla and Svelte shipped working pickers. React already owned the
	// picker (`CustomShowsControls`); it was simply never reachable from the
	// Slide Show tab. A popover keeps the tab's control inventory unchanged
	// while the menu is closed.
	const [showsOpen, setShowsOpen] = useState(false);
	const showsRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!showsOpen) {
			return;
		}
		const handler = (event: MouseEvent) => {
			if (showsRef.current && !showsRef.current.contains(event.target as Node)) {
				setShowsOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [showsOpen]);
	return (
		<>
			<RibbonGroup label={t('pptx.slideShow.start', { defaultValue: 'Start Slide Show' })}>
				<RibbonCommand
					label={t('pptx.slideShow.fromBeginning')}
					icon={<LuPlay />}
					onClick={p.onPresentFromBeginning ?? (() => p.onSetMode('present'))}
					title={t('pptx.slideShow.fromBeginningTooltip')}
				/>
				<RibbonCommand
					label={t('pptx.slideShow.fromCurrent')}
					icon={<LuMonitorPlay />}
					onClick={p.onPresent}
					title={t('pptx.slideShow.fromCurrentTooltip')}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideShow.present', { defaultValue: 'Present' })}>
				<RibbonCommand
					label={t('pptx.slideShow.presenterView')}
					icon={<LuPresentation />}
					onClick={p.onEnterPresenterView}
					title={t('pptx.slideShow.presenterViewTooltip')}
				/>
				<div className='relative' ref={showsRef}>
					<RibbonCommand
						label={t('pptx.slideShow.customShow', { defaultValue: 'Custom Show' })}
						icon={<LuListVideo />}
						onClick={() => setShowsOpen((open) => !open)}
						active={showsOpen}
						title={t('pptx.customShows.customShowTooltip')}
					/>
					{showsOpen && (
						<RibbonMenu anchorRef={showsRef} className='pt-1'>
							<div className='flex items-center gap-1 rounded-lg border border-border bg-popover p-2 shadow-2xl'>
								<CustomShowsControls {...p.customShowControls} />
							</div>
						</RibbonMenu>
					)}
				</div>
				{!isHidden('broadcast') && (
					<RibbonCommand
						label={t('pptx.slideShow.broadcast')}
						icon={<LuCast />}
						onClick={p.onOpenBroadcastDialog}
						title={t('pptx.slideShow.broadcastTooltip')}
					/>
				)}
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideShow.setUpGroup', { defaultValue: 'Set Up' })}>
				<RibbonCommand
					label={t('pptx.slideShow.rehearseCoach', { defaultValue: 'Rehearse with Coach' })}
					icon={<LuVideo />}
					disabled
				/>
				<RibbonCommand
					label={t('pptx.slideShow.setUp')}
					icon={<LuSettings2 />}
					onClick={p.onOpenSetUpSlideShow}
					title={t('pptx.slideShow.setUpTooltip')}
				/>
				<RibbonCommand
					label={t('pptx.slideShow.hideSlide', { defaultValue: 'Hide Slide' })}
					icon={<LuEyeOff />}
					onClick={p.onToggleHideSlide}
					active={p.activeSlideHidden}
					pressed={p.activeSlideHidden}
				/>
				<RibbonCommand
					label={t('pptx.slideShow.rehearseTimings')}
					icon={<LuClock3 />}
					onClick={p.onEnterRehearsalMode}
					title={t('pptx.slideShow.rehearseTimingsTooltip')}
				/>
				<RibbonCommand
					label={t('pptx.titleBar.record')}
					icon={<LuVideo />}
					onClick={p.onEnterRehearsalMode}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideShow.options', { defaultValue: 'Options' })}>
				{/* The Options cluster used to be four hard-coded `checked` boxes with
				    no `onChange`, so "Use Timings" claimed to be on whether or not the
				    deck said so. Both supported entries now read and write the deck's
				    presentation properties; the two nothing backs render disabled. */}
				<RibbonCommandStack>
					{SLIDE_SHOW_OPTIONS.slice(0, 3).map((option) => (
						<RibbonToggle
							key={option.id}
							label={t(option.labelKey)}
							checked={readSlideShowOption(p.presentationProperties, option.id)}
							disabled={option.unsupported}
							onChange={
								option.unsupported
									? undefined
									: (next) => {
											const change = slideShowOptionChange(option.id, next);
											if (change) {
												p.onPresentationPropertiesChange?.(change);
											}
										}
							}
						/>
					))}
				</RibbonCommandStack>
				<RibbonCommandStack>
					<RibbonToggle
						label={t(SLIDE_SHOW_OPTIONS[3].labelKey)}
						checked={readSlideShowOption(p.presentationProperties, SLIDE_SHOW_OPTIONS[3].id)}
						disabled={SLIDE_SHOW_OPTIONS[3].unsupported}
					/>
					<RibbonToggle
						label={t('pptx.slideShow.subtitles')}
						checked={p.showSubtitles}
						onChange={() => p.onToggleSubtitles()}
						title={t('pptx.slideShow.subtitlesTooltip')}
					/>
					<RibbonCommand
						compact
						label={t('pptx.slideShow.subtitleSettings', { defaultValue: 'Subtitle Settings' })}
						icon={<LuCaptions />}
						onClick={p.onToggleSubtitles}
					/>
				</RibbonCommandStack>
			</RibbonGroup>
		</>
	);
}
