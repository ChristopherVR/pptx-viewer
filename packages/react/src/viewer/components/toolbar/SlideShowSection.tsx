import type { PptxPresentationProperties } from 'pptx-viewer-core';
import type { ToolbarActionId, RibbonControlId } from 'pptx-viewer-shared';
import { SLIDE_SHOW_COMMAND_GROUPS } from 'pptx-viewer-shared';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import type { ViewerMode } from '../../types';
import { CustomShowsControls } from './CustomShowsControls';
import type { CustomShowsControlsProps } from './CustomShowsControls';
import { RibbonGroupScope } from './PowerPointRibbonControls';
import { RibbonMenu } from './RibbonMenu';
import { SlideShowOptions } from './SlideShowOptions';
import { SubtitleSettingsControl } from './SubtitleSettingsControl';
import { WebRibbonCommand, WebRibbonGroup, WebRibbonToggle } from './WebRibbonControls';

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
	const actions: Partial<Record<RibbonControlId, () => void>> = {
		'slideShow.startSlideShow.fromBeginning':
			p.onPresentFromBeginning ?? (() => p.onSetMode('present')),
		'slideShow.startSlideShow.fromCurrent': p.onPresent,
		'slideShow.present.presenterView': p.onEnterPresenterView,
		'slideShow.startSlideShow.customShow': () => setShowsOpen((open) => !open),
		'slideShow.present.broadcast': p.onOpenBroadcastDialog,
		'slideShow.setUp.setUpSlideShow': p.onOpenSetUpSlideShow,
		'slideShow.setUp.hideSlide': p.onToggleHideSlide,
		'slideShow.setUp.rehearseTimings': p.onEnterRehearsalMode,
		'slideShow.setUp.record': p.onEnterRehearsalMode,
	};
	const request = (id: RibbonControlId) => actions[id]?.();
	return (
		<>
			{SLIDE_SHOW_COMMAND_GROUPS.map((group) => (
				<WebRibbonGroup key={group.id} groupId={group.id} label={t(group.labelKey)}>
					{group.commands
						.filter(
							(command) => command.id !== 'slideShow.present.broadcast' || !isHidden('broadcast'),
						)
						.map((command) => {
							const customShow = command.id === 'slideShow.startSlideShow.customShow';
							const hideSlide = command.id === 'slideShow.setUp.hideSlide';
							const button = (
								<WebRibbonCommand
									key={command.id}
									controlId={command.id}
									label={t(command.labelKey)}
									icon={command.icon}
									title={t(command.tooltipKey ?? command.labelKey)}
									disabled={command.unsupported}
									active={hideSlide ? p.activeSlideHidden : customShow ? showsOpen : false}
									pressed={hideSlide ? p.activeSlideHidden : undefined}
									expanded={customShow ? showsOpen : undefined}
									onCommand={request}
								/>
							);
							return customShow ? (
								<div key={command.id} className='relative' ref={showsRef}>
									{button}
									{showsOpen && (
										<RibbonMenu anchorRef={showsRef} className='pt-1'>
											<div className='flex items-center gap-1 rounded-lg border border-border bg-popover p-2 shadow-2xl'>
												<CustomShowsControls {...p.customShowControls} />
											</div>
										</RibbonMenu>
									)}
								</div>
							) : (
								button
							);
						})}
				</WebRibbonGroup>
			))}
			<WebRibbonGroup label={t('pptx.slideShow.options')}>
				<SlideShowOptions
					presentationProperties={p.presentationProperties}
					onChange={p.onPresentationPropertiesChange}
				>
					<RibbonGroupScope id='slideShow.captions'>
						<WebRibbonToggle
							controlId='slideShow.captions.subtitles'
							label={t('pptx.slideShow.subtitles')}
							checked={p.showSubtitles}
							title={t('pptx.slideShow.subtitlesTooltip')}
							onToggle={() => p.onToggleSubtitles()}
						/>
						<SubtitleSettingsControl />
					</RibbonGroupScope>
				</SlideShowOptions>
			</WebRibbonGroup>
		</>
	);
}
