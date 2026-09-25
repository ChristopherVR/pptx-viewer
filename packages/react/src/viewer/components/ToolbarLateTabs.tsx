import React from 'react';

import type { ToolbarSection } from '../types';
import { AnimationsSection } from './toolbar/AnimationsSection';
import { TransitionsSection } from './toolbar/DesignTransitionsReviewSection';
import { HelpSection } from './toolbar/HelpSection';
import { RecordSection } from './toolbar/RecordSection';
import { ReviewSection } from './toolbar/ReviewSection';
import { SlideShowSection } from './toolbar/SlideShowSection';
import type { ToolbarProps } from './toolbar/toolbar-types';
import { ViewSection } from './toolbar/ViewSection';

/**
 * The ribbon content of the tabs after Design (Transitions to Help), split
 * out of `Toolbar` to keep that file within the repo's size budget.
 */
export function ToolbarLateTabs({
	p,
	section,
}: {
	p: ToolbarProps;
	section: ToolbarSection | null;
}): React.ReactElement {
	return (
		<>
			{section === 'transitions' && (
				<TransitionsSection
					isInspectorPaneOpen={p.isInspectorPaneOpen}
					onToggleInspector={p.onToggleInspector}
					canEdit={p.canEdit}
					activeSlide={p.activeSlide}
					onTransitionChange={p.onTransitionChange}
					onApplyTransitionToAll={p.onApplyTransitionToAll}
				/>
			)}

			{section === 'animations' && (
				<AnimationsSection
					canEdit={p.canEdit}
					selectedElement={p.selectedElement}
					activeSlide={p.activeSlide}
					isInspectorPaneOpen={p.isInspectorPaneOpen}
					onToggleInspector={p.onToggleInspector}
					onOpenAnimationPanel={p.onOpenAnimationPanel}
					onAddAnimation={p.onAddAnimation}
					onRemoveAnimation={p.onRemoveAnimation}
				/>
			)}

			{section === 'slideShow' && (
				<SlideShowSection
					onPresent={() => p.onSetMode('present')}
					onPresentFromBeginning={p.onPresentFromBeginning}
					onEnterPresenterView={p.onEnterPresenterView ?? (() => {})}
					onEnterRehearsalMode={p.onEnterRehearsalMode ?? (() => {})}
					onOpenSetUpSlideShow={p.onOpenSetUpSlideShow ?? (() => {})}
					onToggleHideSlide={p.onToggleHideSlide ?? (() => {})}
					activeSlideHidden={p.activeSlideHidden ?? false}
					onOpenBroadcastDialog={p.onOpenBroadcastDialog ?? (() => {})}
					onToggleSubtitles={p.onToggleSubtitles ?? (() => {})}
					showSubtitles={p.showSubtitles ?? false}
					onSetMode={p.onSetMode}
					customShowControls={p}
					hiddenActions={p.hiddenActions}
					presentationProperties={p.presentationProperties}
					onPresentationPropertiesChange={p.onPresentationPropertiesChange}
				/>
			)}

			{section === 'record' && (
				<RecordSection
					onRecordFromBeginning={p.onEnterRehearsalMode ?? (() => {})}
					onRecordFromCurrent={p.onEnterRehearsalMode ?? (() => {})}
				/>
			)}

			{section === 'review' && (
				<ReviewSection
					canEdit={p.canEdit}
					spellCheckEnabled={p.spellCheckEnabled}
					onSetSpellCheckEnabled={p.onSetSpellCheckEnabled}
					onToggleComments={p.onToggleComments}
					isCommentsPanelOpen={p.isCommentsPanelOpen}
					slideCommentCount={p.slideCommentCount}
					onCompare={p.onCompare}
					onOpenAccessibilityCheck={p.onRunAccessibilityCheck}
					onSetLanguage={p.onOpenSettings}
				/>
			)}

			{section === 'view' && (
				<ViewSection
					canEdit={p.canEdit}
					editTemplateMode={p.editTemplateMode}
					onSetEditTemplateMode={p.onSetEditTemplateMode}
					spellCheckEnabled={p.spellCheckEnabled}
					onSetSpellCheckEnabled={p.onSetSpellCheckEnabled}
					showGrid={p.showGrid}
					showRulers={p.showRulers}
					showGuides={p.showGuides}
					snapToGrid={p.snapToGrid}
					snapToShape={p.snapToShape}
					onSetShowGrid={p.onSetShowGrid}
					onSetShowRulers={p.onSetShowRulers}
					onSetShowGuides={p.onSetShowGuides}
					onSetSnapToGrid={p.onSetSnapToGrid}
					onSetSnapToShape={p.onSetSnapToShape}
					onAddGuide={p.onAddGuide}
					onEnterMasterView={p.onEnterMasterView}
					isSelectionPaneOpen={p.isSelectionPaneOpen}
					onToggleSelectionPane={p.onToggleSelectionPane}
					eyedropperActive={p.eyedropperActive}
					onToggleEyedropper={p.onToggleEyedropper}
					onToggleSlideSorter={p.onToggleSlideSorter}
					onGoToNormalView={p.onGoToNormalView}
					onOpenReadingView={p.onOpenReadingView}
					onOpenOutlineView={p.onOpenOutlineView}
					onZoomToFit={p.onZoomToFit}
				/>
			)}

			{section === 'help' && (
				<HelpSection
					onOpenSettings={p.onOpenSettings}
					onToggleShortcuts={p.onToggleShortcuts}
					onRunAccessibilityCheck={p.onRunAccessibilityCheck}
				/>
			)}
		</>
	);
}
