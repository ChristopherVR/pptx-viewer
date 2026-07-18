import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuBookOpen,
	LuCode,
	LuGrid3X3,
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
	snapToGrid: boolean;
	snapToShape: boolean;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onEnterMasterView: () => void;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onToggleSlideSorter?: () => void;
	onZoomToFit?: () => void;
}

export function ViewSection(p: ViewSectionProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<>
			<RibbonGroup label={t('pptx.view.presentationViews')}>
				<RibbonCommand label={t('pptx.view.normal')} icon={<LuPanelTop />} title='Normal view' />
				<RibbonCommand
					label={t('pptx.slideSorter.title')}
					icon={<LuLayoutGrid />}
					onClick={p.onToggleSlideSorter}
					title='Slide Sorter view'
				/>
				<RibbonCommand
					label={t('pptx.view.readingView')}
					icon={<LuBookOpen />}
					disabled
					title='Reading View'
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.view.masterViews')}>
				<RibbonCommand
					label={t('pptx.master.title')}
					icon={<LuPresentation />}
					onClick={p.onEnterMasterView}
					disabled={!p.canEdit}
					title='Edit slide masters and layouts'
				/>
				<RibbonCommand
					label={t('pptx.master.handoutMasterTitle', { defaultValue: 'Handout Master' })}
					icon={<LuGrid3X3 />}
					disabled
				/>
				<RibbonCommand
					label={t('pptx.master.notesMasterTitle', { defaultValue: 'Notes Master' })}
					icon={<LuStickyNote />}
					disabled
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.view.show', { defaultValue: 'Show' })}>
				<RibbonCommandStack>
					<RibbonToggle
						label={t('pptx.ruler.rulers')}
						checked={p.showRulers}
						onChange={p.onSetShowRulers}
					/>
					<RibbonToggle
						label={t('pptx.grid.grid')}
						checked={p.showGrid}
						onChange={p.onSetShowGrid}
						title='Toggle grid'
					/>
					<RibbonToggle
						label={t('pptx.view.guides', { defaultValue: 'Guides' })}
						checked={p.snapToShape}
						onChange={p.onSetSnapToShape}
					/>
					<RibbonToggle label='Snap to grid' checked={p.snapToGrid} onChange={p.onSetSnapToGrid} />
				</RibbonCommandStack>
				<RibbonCommandStack>
					<RibbonCommand
						compact
						label={t('pptx.view.selection')}
						icon={<LuList />}
						onClick={p.onToggleSelectionPane}
						active={p.isSelectionPaneOpen}
						title='Selection Pane'
					/>
					<RibbonCommand
						compact
						label={t('pptx.ribbon.eyedropper')}
						icon={<LuPipette />}
						onClick={p.onToggleEyedropper}
						active={p.eyedropperActive}
						disabled={!p.canEdit}
					/>
					<RibbonCommand compact label='Snap to shape' icon={<LuGrid3X3 />} disabled />
					<RibbonCommand
						compact
						label='H Guide'
						icon={<LuRuler />}
						onClick={() => p.onAddGuide('h')}
						title='Add horizontal guide'
					/>
					<RibbonCommand
						compact
						label='V Guide'
						icon={<LuRuler />}
						onClick={() => p.onAddGuide('v')}
						title='Add vertical guide'
					/>
				</RibbonCommandStack>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideSorter.zoom')}>
				<RibbonCommand label={t('pptx.slideSorter.zoom')} icon={<LuZoomIn />} disabled />
				<RibbonCommand
					label={t('pptx.view.zoomToFit')}
					icon={<LuMaximize2 />}
					onClick={p.onZoomToFit}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.view.window', { defaultValue: 'Window' })}>
				<RibbonCommand
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
					label={t('pptx.view.macros', { defaultValue: 'Macros' })}
					icon={<LuCode />}
					disabled
				/>
			</RibbonGroup>
		</>
	);
}
