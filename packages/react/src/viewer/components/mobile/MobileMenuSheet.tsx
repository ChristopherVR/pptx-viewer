import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuChevronRight,
	LuClipboardCopy,
	LuFile,
	LuLayoutGrid,
	LuPaintbrush,
	LuPlus,
	LuPresentation,
	LuSettings,
	LuShapes,
	LuSparkles,
	LuTextCursorInput,
	LuType,
	LuWand,
} from 'react-icons/lu';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import { cn } from '../../utils';
import { AnimationsSection } from '../toolbar/AnimationsSection';
import { ArrangeSection } from '../toolbar/ArrangeSection';
import { DesignSection, TransitionsSection } from '../toolbar/DesignTransitionsReviewSection';
import { DrawSection } from '../toolbar/DrawSection';
import { FileSection } from '../toolbar/FileSection';
import { HomeSection } from '../toolbar/HomeSection';
import { InsertSection } from '../toolbar/InsertSection';
import { ReviewSection } from '../toolbar/ReviewSection';
import { SlideShowSection } from '../toolbar/SlideShowSection';
import { TextSection } from '../toolbar/TextSection';
import type { ToolbarProps } from '../toolbar/toolbar-types';
import { ViewSection } from '../toolbar/ViewSection';
import { MobileSheet } from './MobileSheet';

type MenuKey =
	| null
	| 'home'
	| 'insert'
	| 'text'
	| 'draw'
	| 'arrange'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'slideShow'
	| 'review'
	| 'view'
	| 'file';

interface MenuItemDef {
	key: Exclude<MenuKey, null>;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

const MENU_ITEMS: MenuItemDef[] = [
	{ key: 'home', label: 'pptx.ribbon.tab.home', icon: LuClipboardCopy },
	{ key: 'insert', label: 'pptx.ribbon.tab.insert', icon: LuPlus },
	{ key: 'text', label: 'pptx.ribbon.tab.text', icon: LuType },
	{ key: 'draw', label: 'pptx.ribbon.tab.draw', icon: LuPaintbrush },
	{ key: 'arrange', label: 'pptx.ribbon.tab.arrange', icon: LuShapes },
	{ key: 'design', label: 'pptx.ribbon.tab.design', icon: LuLayoutGrid },
	{ key: 'transitions', label: 'pptx.ribbon.tab.transitions', icon: LuSparkles },
	{ key: 'animations', label: 'pptx.ribbon.tab.animations', icon: LuWand },
	{ key: 'slideShow', label: 'pptx.ribbon.tab.slideShow', icon: LuPresentation },
	{ key: 'review', label: 'pptx.ribbon.tab.review', icon: LuTextCursorInput },
	{ key: 'view', label: 'pptx.ribbon.tab.view', icon: LuSettings },
	{ key: 'file', label: 'pptx.ribbon.tab.file', icon: LuFile },
];

export interface MobileMenuSheetProps extends ToolbarProps {
	open: boolean;
	onClose: () => void;
}

/**
 * Drawer-style sheet exposing every ribbon section in a single mobile-friendly
 * scroll. Tapping a section title expands it inline; the existing section
 * components are reused so functionality is identical to desktop.
 */
export function MobileMenuSheet(props: MobileMenuSheetProps): React.ReactElement {
	const { t } = useTranslation();
	const { open, onClose } = props;
	const [active, setActive] = useState<MenuKey>('home');
	const { isTabVisible } = useToolbarVisibility(props.hiddenActions);

	return (
		<MobileSheet open={open} onClose={onClose} autoHeight title={t('pptx.mobileToolbar.menu')}>
			<div className='flex flex-col'>
				{/* Section selector: chips wrap so every section stays reachable
				    without horizontal scrolling (which hid the trailing sections). */}
				<div className='sticky top-0 z-10 bg-background border-b border-border'>
					<div className='flex flex-wrap gap-1.5 px-3 py-2'>
						{MENU_ITEMS.filter(({ key }) => isTabVisible(key)).map(({ key, label, icon: Icon }) => (
							<button
								key={key}
								type='button'
								onClick={() => setActive(active === key ? null : key)}
								className={cn(
									'inline-flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-[12px] font-medium border transition-colors min-h-[36px]',
									active === key
										? 'bg-primary text-white border-primary'
										: 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/40',
								)}
							>
								<Icon className='w-4 h-4' />
								{t(label)}
							</button>
						))}
					</div>
				</div>

				{/* Active section body */}
				<div className='p-3'>
					<MobileSectionBody active={active} {...props} />
				</div>
			</div>
		</MobileSheet>
	);
}

function MobileSectionBody({
	active,
	...p
}: { active: MenuKey } & ToolbarProps): React.ReactElement | null {
	// Re-use the desktop section components inside a vertical mobile layout.
	// The wrapper applies `flex-wrap` and larger touch targets through
	// global overrides in toolbar-constants `pill` / `ic` are already styled,
	// but here we let them flow and wrap.
	const wrap = 'flex flex-wrap items-center gap-2';

	switch (active) {
		case 'home':
			return (
				<div className={wrap}>
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
				</div>
			);
		case 'insert':
			return (
				<div className={wrap}>
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
						onOpenImagePicker={p.onOpenImagePicker}
						onOpenMediaPicker={p.onOpenMediaPicker}
					/>
				</div>
			);
		case 'text':
			return (
				<div className={wrap}>
					<TextSection
						canEdit={p.canEdit}
						selectedElement={p.selectedElement}
						tableEditorState={p.tableEditorState}
						onUpdateTextStyle={p.onUpdateTextStyle}
						onTransformTextCase={p.onTransformTextCase}
					/>
				</div>
			);
		case 'draw':
			return (
				<div className={wrap}>
					<DrawSection
						activeTool={p.activeTool}
						drawingColor={p.drawingColor}
						drawingWidth={p.drawingWidth}
						onSetActiveTool={p.onSetActiveTool}
						onSetDrawingColor={p.onSetDrawingColor}
						onSetDrawingWidth={p.onSetDrawingWidth}
					/>
				</div>
			);
		case 'arrange':
			return (
				<div className={wrap}>
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
				</div>
			);
		case 'design':
			return (
				<div className={wrap}>
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
				</div>
			);
		case 'transitions':
			return (
				<div className={wrap}>
					<TransitionsSection
						isInspectorPaneOpen={p.isInspectorPaneOpen}
						onToggleInspector={p.onToggleInspector}
					/>
				</div>
			);
		case 'animations':
			return (
				<div className={wrap}>
					<AnimationsSection
						canEdit={p.canEdit}
						selectedElement={p.selectedElement}
						isInspectorPaneOpen={p.isInspectorPaneOpen}
						onToggleInspector={p.onToggleInspector}
						onOpenAnimationPanel={p.onOpenAnimationPanel}
						onAddAnimation={p.onAddAnimation}
						onRemoveAnimation={p.onRemoveAnimation}
					/>
				</div>
			);
		case 'slideShow':
			return (
				<div className={wrap}>
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
				</div>
			);
		case 'review':
			return (
				<div className={wrap}>
					<ReviewSection
						canEdit={p.canEdit}
						spellCheckEnabled={p.spellCheckEnabled}
						onSetSpellCheckEnabled={p.onSetSpellCheckEnabled}
						onToggleComments={p.onToggleComments}
						isCommentsPanelOpen={p.isCommentsPanelOpen}
						slideCommentCount={p.slideCommentCount}
						onCompare={p.onCompare}
					/>
				</div>
			);
		case 'view':
			return (
				<div className={wrap}>
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
				</div>
			);
		case 'file':
			return (
				<div className={wrap}>
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
				</div>
			);
		default:
			return (
				<div className='text-center text-sm text-muted-foreground py-8'>
					<LuChevronRight className='w-5 h-5 inline-block opacity-50' />
					{' Select a section above'}
				</div>
			);
	}
}
