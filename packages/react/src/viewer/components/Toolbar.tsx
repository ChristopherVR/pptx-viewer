import React from 'react';
import { useTranslation } from 'react-i18next';

import { TOOLBAR_SECTIONS } from '../constants';
import { useToolbarVisibility } from '../hooks/useToolbarVisibility';
import { cn } from '../utils';
import { MobileToolbar } from './mobile/MobileToolbar';
import { AnimationsSection } from './toolbar/AnimationsSection';
import { ArrangeSection } from './toolbar/ArrangeSection';
import { DesignSection, TransitionsSection } from './toolbar/DesignTransitionsReviewSection';
import { DrawingGroup } from './toolbar/DrawingGroup';
import { DrawSection } from './toolbar/DrawSection';
import { EditingSection } from './toolbar/EditingSection';
import { FileSection } from './toolbar/FileSection';
import { HomeSection } from './toolbar/HomeSection';
import { InsertSection } from './toolbar/InsertSection';
import { RecordSection } from './toolbar/RecordSection';
import { ReviewSection } from './toolbar/ReviewSection';
import { SlideShowSection } from './toolbar/SlideShowSection';
import { TabRowActions } from './toolbar/TabRowActions';
import { TextSection } from './toolbar/TextSection';
import { pill } from './toolbar/toolbar-constants';
import type { ToolbarProps } from './toolbar/toolbar-types';
import { ToolbarPrimaryRow } from './toolbar/ToolbarPrimaryRow';
import { ViewSection } from './toolbar/ViewSection';

export type { ToolbarProps } from './toolbar/toolbar-types';

export function Toolbar(p: ToolbarProps): React.ReactElement {
	const { mode, isNarrowViewport, isCompactToolbarOpen, toolbarSection, onSetToolbarSection } = p;
	const { t } = useTranslation();
	const { isTabVisible } = useToolbarVisibility(p.hiddenActions);

	// Mobile-first: at <768px we swap the entire desktop ribbon for a compact
	// top bar plus a slide-up sheet exposing every section. The bottom action
	// bar is rendered separately by MobileChromeOverlay at the viewer level.
	if (isNarrowViewport && mode !== 'present') {
		return <MobileToolbar {...p} />;
	}

	const sFil = toolbarSection === 'file';
	const sHome = toolbarSection === 'home';
	const sIns = toolbarSection === 'insert';
	const sTxt = sHome || toolbarSection === 'text';
	const sArr = sHome || toolbarSection === 'arrange';
	const sDrw = toolbarSection === 'draw';
	const sDes = toolbarSection === 'design';
	const sTrn = toolbarSection === 'transitions';
	const sAni = toolbarSection === 'animations';
	const sSlw = toolbarSection === 'slideShow';
	const sRec = toolbarSection === 'record';
	const sRev = toolbarSection === 'review';
	const sViw = toolbarSection === 'view';
	const sHlp = toolbarSection === 'help';

	const showRibbon = mode === 'edit' || mode === 'master';

	return (
		<div
			role='toolbar'
			aria-label={t('pptx.toolbar.presentationToolbarAria')}
			className='relative z-20 border-b border-border bg-secondary/50 overflow-visible'
		>
			{/* Quick Access Row: undo/redo + spacer + mode/toggles */}
			<ToolbarPrimaryRow {...p} />

			{/* Ribbon Tab Bar */}
			{showRibbon && (
				<div
					role='tablist'
					className='flex items-center border-b border-border/60 px-1 max-md:overflow-x-auto max-md:scrollbar-none'
				>
					{TOOLBAR_SECTIONS.filter((s) => isTabVisible(s.id)).map((s) => (
						<button
							key={s.id}
							type='button'
							role='tab'
							aria-selected={toolbarSection === s.id}
							onClick={() => onSetToolbarSection(s.id)}
							className={cn(
								'relative px-3.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors max-md:min-h-[36px] max-md:px-3',
								toolbarSection === s.id
									? s.id === 'file'
										? 'text-white bg-primary/80 rounded-sm'
										: 'text-foreground after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary'
									: s.id === 'file'
										? 'text-primary hover:bg-primary/15 rounded-sm'
										: 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
							)}
						>
							{t(s.labelKey)}
						</button>
					))}
					<div className='flex-1' />
					<TabRowActions
						onEnterRehearsalMode={p.canEdit ? p.onEnterRehearsalMode : undefined}
						onOpenShareDialog={p.onOpenShareDialog}
						onPackageForSharing={p.onPackageForSharing}
						hiddenActions={p.hiddenActions}
					/>
					{isNarrowViewport && (
						<button
							type='button'
							onClick={p.onToggleCompactToolbar}
							className={cn(
								'px-2 py-1 rounded text-[11px] transition-colors mr-1',
								isCompactToolbarOpen
									? 'bg-primary/80 text-white'
									: 'text-muted-foreground hover:text-foreground',
							)}
							title={t(
								isCompactToolbarOpen ? 'pptx.ribbon.collapseRibbon' : 'pptx.ribbon.expandRibbon',
							)}
						>
							{t(isCompactToolbarOpen ? 'pptx.ribbon.collapseRibbon' : 'pptx.ribbon.expandRibbon')}
						</button>
					)}
				</div>
			)}

			{/* Ribbon Content */}
			{showRibbon && (
				<div
					className={cn(
						'flex min-h-[82px] items-stretch gap-0 overflow-x-auto px-1 py-0.5 max-md:min-h-0 max-md:px-1 max-md:py-0.5 flex-nowrap [&>*]:shrink-0',
						isNarrowViewport && !isCompactToolbarOpen && 'hidden',
					)}
				>
					{sFil && (
						<FileSection
							fileName={p.fileName}
							onClose={() => p.onSetToolbarSection('home')}
							onCreatePresentation={p.onCreatePresentation}
							onOpenFile={p.onOpenFile}
							onOpenRecentFile={p.onOpenRecentFile}
							onExportPng={p.onExportPng}
							onExportPdf={p.onExportPdf}
							onExportVideo={p.onExportVideo}
							onExportGif={p.onExportGif}
							onPackageForSharing={p.onPackageForSharing}
							onSaveAsPptx={p.onSaveAsPptx}
							onSaveAsPpsx={p.onSaveAsPpsx}
							onSaveAsPptm={p.onSaveAsPptm}
							hasMacros={p.hasMacros}
							onCopySlideAsImage={p.onCopySlideAsImage}
							onPrint={p.onPrint}
							onOpenSettings={p.onOpenSettings}
							onOpenShareDialog={p.onOpenShareDialog}
							onOpenDocumentProperties={p.onOpenDocumentProperties}
							onOpenPasswordProtection={p.onOpenPasswordProtection}
							onOpenFontEmbedding={p.onOpenFontEmbedding}
							onOpenDigitalSignatures={p.onOpenDigitalSignatures}
							hiddenActions={p.hiddenActions}
						/>
					)}

					{sHome && (
						<HomeSection
							canEdit={p.canEdit}
							clipboardPayload={p.clipboardPayload}
							formatPainterActive={p.formatPainterActive}
							canActivateFormatPainter={p.canActivateFormatPainter}
							onCopy={p.onCopy}
							onCut={p.onCut}
							onPaste={p.onPaste}
							onToggleFormatPainter={p.onToggleFormatPainter}
							layoutOptions={p.layoutOptions}
							onInsertSlideFromLayout={p.onInsertSlideFromLayout}
							selectedElement={p.selectedElement}
							onUpdateTextStyle={p.onUpdateTextStyle}
						/>
					)}

					{sIns && (
						<InsertSection
							canEdit={p.canEdit}
							newShapeType={p.newShapeType}
							onSetNewShapeType={p.onSetNewShapeType}
							onAddTextBox={p.onAddTextBox}
							onAddShape={p.onAddShape}
							onAddTable={p.onAddTable}
							onAddChart={p.onAddChart}
							onAddSmartArt={p.onAddSmartArt}
							onAddEquation={p.onAddEquation}
							onAddActionButton={p.onAddActionButton}
							onInsertField={p.onInsertField}
							onOpenHeaderFooter={p.onOpenHeaderFooter}
							onOpenImagePicker={p.onOpenImagePicker}
							onOpenMediaPicker={p.onOpenMediaPicker}
						/>
					)}

					{sTxt && (
						<TextSection
							canEdit={p.canEdit}
							selectedElement={p.selectedElement}
							tableEditorState={p.tableEditorState}
							onUpdateTextStyle={p.onUpdateTextStyle}
							onTransformTextCase={p.onTransformTextCase}
						/>
					)}

					{sHome && <EditingSection onToggleFindReplace={p.onToggleFindReplace} />}

					{sHome && (
						<DrawingGroup
							canEdit={p.canEdit}
							selectedElement={p.selectedElement}
							newShapeType={p.newShapeType}
							onSetNewShapeType={p.onSetNewShapeType}
							onAddShape={p.onAddShape}
							onMoveLayer={p.onMoveLayer}
							onMoveLayerToEdge={p.onMoveLayerToEdge}
						/>
					)}

					{sDrw && (
						<DrawSection
							activeTool={p.activeTool}
							drawingColor={p.drawingColor}
							drawingWidth={p.drawingWidth}
							onSetActiveTool={p.onSetActiveTool}
							onSetDrawingColor={p.onSetDrawingColor}
							onSetDrawingWidth={p.onSetDrawingWidth}
						/>
					)}

					{sArr && (
						<ArrangeSection
							canEdit={p.canEdit}
							selectedElement={p.selectedElement}
							clipboardPayload={p.clipboardPayload}
							onAlignElements={p.onAlignElements}
							onDistributeElements={p.onDistributeElements}
							canDistribute={p.canDistribute}
							onCopy={p.onCopy}
							onCut={p.onCut}
							onPaste={p.onPaste}
							onFlip={p.onFlip}
							onMoveLayer={p.onMoveLayer}
							onMoveLayerToEdge={p.onMoveLayerToEdge}
							onDuplicate={p.onDuplicate}
							onDelete={p.onDelete}
							formatPainterActive={p.formatPainterActive}
							onToggleFormatPainter={p.onToggleFormatPainter}
							canActivateFormatPainter={p.canActivateFormatPainter}
						/>
					)}

					{sDes && (
						<DesignSection
							canEdit={p.canEdit}
							onToggleThemeGallery={p.onToggleThemeGallery}
							isThemeGalleryOpen={p.isThemeGalleryOpen}
							onToggleThemeEditor={p.onToggleThemeEditor}
							isThemeEditorOpen={p.isThemeEditorOpen}
							onOpenDocumentProperties={p.onOpenDocumentProperties}
							onToggleInspector={p.onToggleInspector}
							isInspectorPaneOpen={p.isInspectorPaneOpen}
						/>
					)}

					{sTrn && (
						<TransitionsSection
							isInspectorPaneOpen={p.isInspectorPaneOpen}
							onToggleInspector={p.onToggleInspector}
						/>
					)}

					{sAni && (
						<AnimationsSection
							canEdit={p.canEdit}
							selectedElement={p.selectedElement}
							isInspectorPaneOpen={p.isInspectorPaneOpen}
							onToggleInspector={p.onToggleInspector}
							onOpenAnimationPanel={p.onOpenAnimationPanel}
							onAddAnimation={p.onAddAnimation}
							onRemoveAnimation={p.onRemoveAnimation}
						/>
					)}

					{sSlw && (
						<SlideShowSection
							onPresent={() => p.onSetMode('present')}
							onEnterPresenterView={p.onEnterPresenterView ?? (() => {})}
							onEnterRehearsalMode={p.onEnterRehearsalMode ?? (() => {})}
							onOpenSetUpSlideShow={p.onOpenSetUpSlideShow ?? (() => {})}
							onOpenBroadcastDialog={p.onOpenBroadcastDialog ?? (() => {})}
							onToggleSubtitles={p.onToggleSubtitles ?? (() => {})}
							showSubtitles={p.showSubtitles ?? false}
							onSetMode={p.onSetMode}
							hiddenActions={p.hiddenActions}
						/>
					)}

					{sRec && (
						<RecordSection
							onRecordFromBeginning={p.onEnterRehearsalMode ?? (() => {})}
							onRecordFromCurrent={p.onEnterRehearsalMode ?? (() => {})}
						/>
					)}

					{sRev && (
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

					{sViw && (
						<ViewSection
							canEdit={p.canEdit}
							editTemplateMode={p.editTemplateMode}
							onSetEditTemplateMode={p.onSetEditTemplateMode}
							spellCheckEnabled={p.spellCheckEnabled}
							onSetSpellCheckEnabled={p.onSetSpellCheckEnabled}
							showGrid={p.showGrid}
							showRulers={p.showRulers}
							snapToGrid={p.snapToGrid}
							snapToShape={p.snapToShape}
							onSetShowGrid={p.onSetShowGrid}
							onSetShowRulers={p.onSetShowRulers}
							onSetSnapToGrid={p.onSetSnapToGrid}
							onSetSnapToShape={p.onSetSnapToShape}
							onAddGuide={p.onAddGuide}
							onEnterMasterView={p.onEnterMasterView}
							isSelectionPaneOpen={p.isSelectionPaneOpen}
							onToggleSelectionPane={p.onToggleSelectionPane}
							eyedropperActive={p.eyedropperActive}
							onToggleEyedropper={p.onToggleEyedropper}
							onZoomToFit={p.onZoomToFit}
						/>
					)}

					{sHlp && (
						<>
							<button
								type='button'
								onClick={p.onToggleShortcuts}
								className={pill}
								title={t('pptx.settings.keyboardShortcuts')}
							>
								{t('pptx.settings.keyboardShortcuts')}
							</button>
							<button
								type='button'
								onClick={p.onRunAccessibilityCheck}
								className={pill}
								title={t('pptx.ribbon.accessibilityCheck')}
							>
								{t('pptx.ribbon.accessibilityCheck')}
							</button>
						</>
					)}
				</div>
			)}
		</div>
	);
}
