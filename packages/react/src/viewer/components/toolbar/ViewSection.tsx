import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuBookOpen,
	LuCode,
	LuGrid3X3,
	LuIndentIncrease,
	LuLayoutGrid,
	LuList,
	LuMaximize2,
	LuPanelTop,
	LuPipette,
	LuPresentation,
	LuRuler,
	LuStickyNote,
	LuZoomIn,
} from 'react-icons/lu';

import {
	RibbonCommand,
	RibbonCommandStack,
	RibbonGroup,
	RibbonToggle,
} from './PowerPointRibbonControls';

export interface ViewSectionProps {
	canEdit: boolean;
	editTemplateMode: boolean;
	onSetEditTemplateMode: (mode: boolean) => void;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	showGrid: boolean;
	showRulers: boolean;
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetShowGuides: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onEnterMasterView: () => void;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onToggleSlideSorter?: () => void;
	/**
	 * View > Normal: leave whichever alternate view (slide sorter, reading,
	 * outline, master) is open and return to the ordinary editing canvas.
	 */
	onGoToNormalView?: () => void;
	/** Enter PowerPoint's Reading View (full window, not the fullscreen show). */
	onOpenReadingView?: () => void;
	/** Enter PowerPoint's Outline view: the deck as editable indented text. */
	onOpenOutlineView?: () => void;
	onZoomToFit?: () => void;
}

export function ViewSection(p: ViewSectionProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<>
			<RibbonGroup label={t('pptx.view.presentationViews')} groupId='view.presentationViews'>
				<RibbonCommand
					controlId='view.presentationViews.normal'
					label={t('pptx.view.normal')}
					icon={<LuPanelTop />}
					onClick={p.onGoToNormalView}
					title={t('pptx.statusBar.normalView')}
				/>
				<RibbonCommand
					controlId='view.presentationViews.slideSorter'
					label={t('pptx.slideSorter.title')}
					icon={<LuLayoutGrid />}
					onClick={p.onToggleSlideSorter}
					title={t('pptx.view.slideSorterTooltip')}
				/>
				<RibbonCommand
					controlId='view.presentationViews.outline'
					label={t('pptx.view.outlineView')}
					icon={<LuIndentIncrease />}
					onClick={p.onOpenOutlineView}
					title={t('pptx.view.outlineViewTooltip')}
				/>
				<RibbonCommand
					controlId='view.presentationViews.readingView'
					label={t('pptx.view.readingView')}
					icon={<LuBookOpen />}
					onClick={p.onOpenReadingView}
					title={t('pptx.view.readingView')}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.view.masterViews')} groupId='view.masterViews'>
				<RibbonCommand
					controlId='view.masterViews.slideMaster'
					label={t('pptx.master.title')}
					icon={<LuPresentation />}
					onClick={p.onEnterMasterView}
					disabled={!p.canEdit}
					title={t('pptx.view.slideMasterTooltip')}
				/>
				<RibbonCommand
					controlId='view.masterViews.handoutMaster'
					label={t('pptx.master.handoutMasterTitle', { defaultValue: 'Handout Master' })}
					icon={<LuGrid3X3 />}
					disabled
				/>
				<RibbonCommand
					controlId='view.masterViews.notesMaster'
					label={t('pptx.master.notesMasterTitle', { defaultValue: 'Notes Master' })}
					icon={<LuStickyNote />}
					disabled
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.view.show', { defaultValue: 'Show' })} groupId='view.show'>
				<RibbonCommandStack>
					<RibbonToggle
						controlId='view.show.ruler'
						label={t('pptx.ruler.rulers')}
						checked={p.showRulers}
						onChange={p.onSetShowRulers}
					/>
					<RibbonToggle
						controlId='view.show.gridlines'
						label={t('pptx.grid.grid')}
						checked={p.showGrid}
						onChange={p.onSetShowGrid}
						title={t('pptx.grid.toggleGrid')}
					/>
					{/*
						Guides shows and hides the drawing guides, nothing else. It used
						to drive shape snapping instead, which left the "Snap to shape"
						command below permanently disabled and described a feature that
						lived on a differently-named control.
					*/}
					<RibbonToggle
						controlId='view.show.guides'
						label={t('pptx.view.guides', { defaultValue: 'Guides' })}
						checked={p.showGuides}
						onChange={p.onSetShowGuides}
						title={t('pptx.ribbon.toggleGuides')}
					/>
					<RibbonToggle
						controlId='view.show.snapToGrid'
						label={t('pptx.settings.snapToGrid')}
						checked={p.snapToGrid}
						onChange={p.onSetSnapToGrid}
					/>
				</RibbonCommandStack>
				<RibbonCommandStack>
					<RibbonCommand
						compact
						controlId='view.show.selectionPane'
						label={t('pptx.view.selection')}
						icon={<LuList />}
						onClick={p.onToggleSelectionPane}
						active={p.isSelectionPaneOpen}
						title={t('pptx.selectionPane.title')}
					/>
					<RibbonCommand
						compact
						controlId='view.show.eyedropper'
						label={t('pptx.ribbon.eyedropper')}
						icon={<LuPipette />}
						onClick={p.onToggleEyedropper}
						active={p.eyedropperActive}
						disabled={!p.canEdit}
					/>
					<RibbonCommand
						compact
						controlId='view.show.snapToShape'
						label={t('pptx.view.snapToShape')}
						icon={<LuGrid3X3 />}
						onClick={() => p.onSetSnapToShape(!p.snapToShape)}
						active={p.snapToShape}
						title={t('pptx.view.snapToShape')}
					/>
					<RibbonCommand
						compact
						controlId='view.show.addGuide'
						label={t('pptx.view.hGuide')}
						icon={<LuRuler />}
						onClick={() => p.onAddGuide('h')}
						title={t('pptx.view.addHorizontalGuide')}
					/>
					<RibbonCommand
						compact
						controlId='view.show.addGuide'
						label={t('pptx.view.vGuide')}
						icon={<LuRuler />}
						onClick={() => p.onAddGuide('v')}
						title={t('pptx.view.addVerticalGuide')}
					/>
				</RibbonCommandStack>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideSorter.zoom')} groupId='view.zoom'>
				<RibbonCommand
					controlId='view.zoom.zoom'
					label={t('pptx.slideSorter.zoom')}
					icon={<LuZoomIn />}
					disabled
				/>
				<RibbonCommand
					controlId='view.zoom.fitToWindow'
					label={t('pptx.view.zoomToFit')}
					icon={<LuMaximize2 />}
					onClick={p.onZoomToFit}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.view.window', { defaultValue: 'Window' })} groupId='view.window'>
				<RibbonCommand
					controlId='view.window.templateEditing'
					label={t(p.editTemplateMode ? 'pptx.ribbon.templatesOn' : 'pptx.ribbon.templatesOff')}
					icon={<LuRuler />}
					onClick={() => p.onSetEditTemplateMode(!p.editTemplateMode)}
					active={p.editTemplateMode}
					disabled={!p.canEdit}
					title={t('pptx.view.templateEditingTooltip', {
						defaultValue: 'Toggle template/master element editing',
					})}
				/>
				<RibbonCommand
					controlId='view.window.macros'
					label={t('pptx.view.macros', { defaultValue: 'Macros' })}
					icon={<LuCode />}
					disabled
				/>
			</RibbonGroup>
		</>
	);
}
