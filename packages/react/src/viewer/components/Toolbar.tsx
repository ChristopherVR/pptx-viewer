import { isPanelVisible } from 'pptx-viewer-shared';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useToolbarVisibility } from '../hooks/useToolbarVisibility';
import type { ToolbarSection } from '../types';
import { cn } from '../utils';
import { MobileToolbar } from './mobile/MobileToolbar';
import { ArrangeSection } from './toolbar/ArrangeSection';
import { ContextualTabSection } from './toolbar/ContextualTabSection';
import { DesignSection } from './toolbar/DesignTransitionsReviewSection';
import { DrawingGroup } from './toolbar/DrawingGroup';
import { DrawSection } from './toolbar/DrawSection';
import { EditingSection } from './toolbar/EditingSection';
import { FileSection } from './toolbar/FileSection';
import { HomeSection } from './toolbar/HomeSection';
import { InsertSection } from './toolbar/InsertSection';
import { RibbonTabBar } from './toolbar/RibbonTabBar';
import { TabRowActions } from './toolbar/TabRowActions';
import { TextSection } from './toolbar/TextSection';
import { TitleBarQuickExtras } from './toolbar/TitleBarQuickExtras';
import type { ToolbarProps } from './toolbar/toolbar-types';
import { ToolbarPrimaryRow } from './toolbar/ToolbarPrimaryRow';
import { useContextualRibbonTab } from './toolbar/useContextualRibbonTab';
import { ToolbarLateTabs } from './ToolbarLateTabs';
import { useViewerCustomizationContext } from './viewer-customization-context';
import { useViewerOptionsContext } from './viewer-options-context';

export type { ToolbarProps } from './toolbar/toolbar-types';

export function Toolbar(p: ToolbarProps): React.ReactElement {
	const { mode, isNarrowViewport, isCompactToolbarOpen, toolbarSection, onSetToolbarSection } = p;
	const { t } = useTranslation();
	const { isTabVisible } = useToolbarVisibility(p.hiddenActions);
	const viewerOptions = useViewerOptionsContext();
	const customization = useViewerCustomizationContext();
	const fallBackHome = useCallback(() => onSetToolbarSection('home'), [onSetToolbarSection]);
	const contextual = useContextualRibbonTab(p.selectedElement, customization, fallBackHome);

	// Mobile-first: at <768px we swap the entire desktop ribbon for a compact
	// top bar plus a slide-up sheet exposing every section. The bottom action
	// bar is rendered separately by MobileChromeOverlay at the viewer level.
	if (isNarrowViewport && mode !== 'present') {
		return <MobileToolbar {...p} />;
	}

	// While a contextual tab is shown no fixed section renders; the one render
	// between losing that tab and the fallback landing already shows Home.
	const section: ToolbarSection | null = contextual.active
		? null
		: contextual.fellBack
			? 'home'
			: toolbarSection;
	const sFil = section === 'file';
	const sHome = section === 'home';
	const sIns = section === 'insert';
	const sTxt = sHome || section === 'text';
	const sArr = sHome || section === 'arrange';
	const sDrw = section === 'draw';
	const sDes = section === 'design';

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
				<RibbonTabBar
					isTabVisible={isTabVisible}
					activeSection={contextual.active ? null : section}
					contextualTabs={contextual.visible}
					activeContextual={contextual.active}
					onSelectSection={(id) => {
						contextual.select(null);
						onSetToolbarSection(id);
					}}
					onSelectContextual={contextual.select}
				>
					<TabRowActions
						onEnterRehearsalMode={p.canEdit ? p.onEnterRehearsalMode : undefined}
						onOpenShareDialog={p.onOpenShareDialog}
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
				</RibbonTabBar>
			)}

			{/*
			 * Quick Access strip, relocated: Options > Quick Access Toolbar >
			 * position = "below" moves the configured commands (beyond the
			 * dedicated Save/Undo/Redo trio, which always stays in the title
			 * bar) into their own row under the ribbon tabs instead of the
			 * title bar's inline strip, which suppresses itself for the same
			 * condition (see `TitleBar`).
			 */}
			{showRibbon &&
				viewerOptions.quickAccess.position === 'below' &&
				isPanelVisible(customization, 'quickAccessToolbar') && (
					<div className='flex items-center gap-0.5 border-b border-border/60 px-2 py-1'>
						<TitleBarQuickExtras
							quickAccess={viewerOptions.quickAccess}
							onCommand={p.onQuickCommand}
						/>
					</div>
				)}

			{/* Ribbon Content */}
			{showRibbon && (
				<div
					className={cn(
						// Plain controls stay compact; labelled RibbonGroups opt into stretching.
						// `RibbonGroupScope` wraps controls in a `display: contents` div, so its
						// children are this row's flex items too and must not shrink (a shrunk
						// "Text Box" pill wraps its caption onto two lines).
						'flex min-h-[82px] items-center gap-0 overflow-x-auto px-1 py-0.5 max-md:min-h-0 max-md:px-1 max-md:py-0.5 flex-nowrap [&>*]:shrink-0 [&>.contents>*]:shrink-0',
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
							onExportJson={p.onExportJson}
							onSaveAsPptx={p.onSaveAsPptx}
							onSaveAsPpsx={p.onSaveAsPpsx}
							onSaveAsPptm={p.onSaveAsPptm}
							onSaveAsPpt={p.onSaveAsPpt}
							hasMacros={p.hasMacros}
							onCopySlideAsImage={p.onCopySlideAsImage}
							onPrint={p.onPrint}
							onOpenSettings={p.onOpenSettings}
							onOpenShareDialog={p.onOpenShareDialog}
							onOpenDocumentProperties={p.onOpenDocumentProperties}
							onOpenPasswordProtection={p.onOpenPasswordProtection}
							onOpenFontEmbedding={p.onOpenFontEmbedding}
							onOpenDigitalSignatures={p.onOpenDigitalSignatures}
							onOpenVersionHistory={p.onToggleVersionHistory}
							hiddenActions={p.hiddenActions}
							recentPresentationsCount={p.recentPresentationsCount}
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
							currentLayoutPath={p.currentLayoutPath}
							loadLayoutPreviews={p.loadLayoutPreviews}
							themeFonts={p.themeFonts}
							embeddedFontFamilies={p.embeddedFontFamilies}
							customFontFamilies={p.customFontFamilies}
							onInsertSlideFromLayout={p.onInsertSlideFromLayout}
							onApplyLayout={p.onApplyLayout}
							onInsertSlideFromTemplate={p.onInsertSlideFromTemplate}
							templateScheme={p.templateScheme}
							selectedElement={p.selectedElement}
							tableEditorState={p.tableEditorState}
							onUpdateTextStyle={p.onUpdateTextStyle}
							onResetSlide={p.onResetSlide}
							onAddSection={p.onAddSection}
						/>
					)}

					{sIns && (
						<InsertSection
							canEdit={p.canEdit}
							newShapeType={p.newShapeType}
							onSetNewShapeType={p.onSetNewShapeType}
							activeFreeformTool={p.activeFreeformTool}
							onArmFreeformTool={p.onArmFreeformTool}
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
							hasSelection={Boolean(p.selectedElement)}
							onOpenHyperlinkDialog={p.onOpenHyperlinkDialog}
						/>
					)}

					{sTxt && (
						<TextSection
							canEdit={p.canEdit}
							selectedElement={p.selectedElement}
							tableEditorState={p.tableEditorState}
							onUpdateTextStyle={p.onUpdateTextStyle}
							onToggleBullets={p.onToggleBullets}
							onTransformTextCase={p.onTransformTextCase}
						/>
					)}

					{sHome && (
						<EditingSection
							onToggleFindReplace={p.onToggleFindReplace}
							onSelectAll={p.onSelectAll}
						/>
					)}

					{sHome && (
						<DrawingGroup
							canEdit={p.canEdit}
							selectedElement={p.selectedElement}
							newShapeType={p.newShapeType}
							onSetNewShapeType={p.onSetNewShapeType}
							onAddShape={p.onAddShape}
							onMoveLayer={p.onMoveLayer}
							onMoveLayerToEdge={p.onMoveLayerToEdge}
							onUpdateElementStyle={p.onUpdateElementStyle}
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
							selectedCount={p.selectedCount}
							selectionGroupable={p.selectionGroupable}
							onAlignElements={p.onAlignElements}
							onDistributeElements={p.onDistributeElements}
							canDistribute={p.canDistribute}
							onFlip={p.onFlip}
							onMoveLayer={p.onMoveLayer}
							onMoveLayerToEdge={p.onMoveLayerToEdge}
							onGroupElements={p.onGroupElements}
							onUngroupElement={p.onUngroupElement}
							onUpdateElementStyle={p.onUpdateElementStyle}
							onDuplicate={p.onDuplicate}
							onDelete={p.onDelete}
							formatPainterActive={p.formatPainterActive}
							onToggleFormatPainter={p.onToggleFormatPainter}
							canActivateFormatPainter={p.canActivateFormatPainter}
							hiddenActions={p.hiddenActions}
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
							onOpenSlideSize={p.onOpenSlideSize}
							onToggleInspector={p.onToggleInspector}
							isInspectorPaneOpen={p.isInspectorPaneOpen}
						/>
					)}

					<ToolbarLateTabs p={p} section={section} />

					{contextual.active && <ContextualTabSection tab={contextual.active} />}
				</div>
			)}
		</div>
	);
}
