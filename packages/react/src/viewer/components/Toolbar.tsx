import React from 'react';

import { TOOLBAR_SECTIONS } from '../constants';
import { cn } from '../utils';
import { MobileToolbar } from './mobile/MobileToolbar';
import { AnimationsSection } from './toolbar/AnimationsSection';
import { ArrangeSection } from './toolbar/ArrangeSection';
import {
	DesignSection,
	TransitionsSection,
	ReviewSection,
} from './toolbar/DesignTransitionsReviewSection';
import { DrawSection } from './toolbar/DrawSection';
import { FileSection } from './toolbar/FileSection';
import { HomeSection } from './toolbar/HomeSection';
import { InsertSection } from './toolbar/InsertSection';
import { SlideShowSection } from './toolbar/SlideShowSection';
import { TextSection } from './toolbar/TextSection';
import { pill } from './toolbar/toolbar-constants';
import type { ToolbarProps } from './toolbar/toolbar-types';
import { ToolbarPrimaryRow } from './toolbar/ToolbarPrimaryRow';
import { ViewSection } from './toolbar/ViewSection';

export type { ToolbarProps } from './toolbar/toolbar-types';

export function Toolbar(p: ToolbarProps): React.ReactElement {
	const { mode, isNarrowViewport, isCompactToolbarOpen, toolbarSection, onSetToolbarSection } = p;

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
	const sArr = toolbarSection === 'arrange';
	const sDrw = toolbarSection === 'draw';
	const sDes = toolbarSection === 'design';
	const sTrn = toolbarSection === 'transitions';
	const sAni = toolbarSection === 'animations';
	const sSlw = toolbarSection === 'slideShow';
	const sRev = toolbarSection === 'review';
	const sViw = toolbarSection === 'view';
	const sHlp = toolbarSection === 'help';

	const showRibbon = mode === 'edit' || mode === 'master';

	return (
		<div
			role='toolbar'
			aria-label='Presentation toolbar'
			className='relative z-20 border-b border-border bg-secondary/50 overflow-visible'
		>
			{/* Quick Access Row: undo/redo + spacer + mode/toggles */}
			<ToolbarPrimaryRow {...p} />

			{/* Ribbon Tab Bar */}
			{showRibbon && (
				<div className='flex items-center border-b border-border/60 px-1 max-md:overflow-x-auto max-md:scrollbar-none'>
					{TOOLBAR_SECTIONS.map((s) => (
						<button
							key={s.id}
							type='button'
							onClick={() => onSetToolbarSection(s.id)}
							className={cn(
								'relative px-3.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors max-md:min-h-[36px] max-md:px-3',
								toolbarSection === s.id
									? s.id === 'file'
										? 'text-primary-foreground bg-primary/80 rounded-sm'
										: 'text-foreground after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary'
									: s.id === 'file'
										? 'text-primary hover:bg-primary/15 rounded-sm'
										: 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
							)}
						>
							{s.label}
						</button>
					))}
					<div className='flex-1' />
					{isNarrowViewport && (
						<button
							type='button'
							onClick={p.onToggleCompactToolbar}
							className={cn(
								'px-2 py-1 rounded text-[11px] transition-colors mr-1',
								isCompactToolbarOpen
									? 'bg-primary/80 text-primary-foreground'
									: 'text-muted-foreground hover:text-foreground',
							)}
							title='Toggle ribbon'
						>
							{isCompactToolbarOpen ? 'Collapse' : 'Expand'}
						</button>
					)}
				</div>
			)}

			{/* Ribbon Content */}
			{showRibbon && (
				<div
					className={cn(
						'flex items-center gap-1.5 px-2 py-1 max-md:px-1 max-md:py-0.5 overflow-visible flex-nowrap',
						isNarrowViewport && !isCompactToolbarOpen && 'hidden',
					)}
				>
					{sFil && (
						<FileSection
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
							onOpenDocumentProperties={p.onOpenDocumentProperties}
							onOpenPasswordProtection={p.onOpenPasswordProtection}
							onOpenFontEmbedding={p.onOpenFontEmbedding}
							onOpenDigitalSignatures={p.onOpenDigitalSignatures}
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
							onAddSmartArt={p.onAddSmartArt}
							onAddEquation={p.onAddEquation}
							onAddActionButton={p.onAddActionButton}
							onInsertField={p.onInsertField}
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
						/>
					)}

					{sHlp && (
						<>
							<button
								type='button'
								onClick={p.onToggleShortcuts}
								className={pill}
								title='Keyboard shortcuts'
							>
								Keyboard Shortcuts
							</button>
							<button
								type='button'
								onClick={p.onRunAccessibilityCheck}
								className={pill}
								title='Accessibility check'
							>
								Accessibility
							</button>
						</>
					)}
				</div>
			)}
		</div>
	);
}
