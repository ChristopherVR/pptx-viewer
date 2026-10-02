import {
	DESIGN_RIBBON_COMMANDS,
	DESIGN_RIBBON_GROUPS,
	designCommandState,
	FIXED_TAB_GALLERIES,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuPalette, LuType } from 'react-icons/lu';

import { RibbonGallery } from './RibbonGallery';
import { WebRibbonCommand, WebRibbonGroup } from './WebRibbonControls';

export interface DesignSectionProps {
	canEdit: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onOpenDocumentProperties?: () => void;
	onOpenSlideSize?: () => void;
	onToggleInspector?: () => void;
	isInspectorPaneOpen?: boolean;
}

export function DesignSection(p: DesignSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const actions = {
		'design.themes.browseThemes': p.onToggleThemeGallery,
		'design.themes.editTheme': p.onToggleThemeEditor,
		'design.customize.slideSize': p.onOpenSlideSize ?? p.onOpenDocumentProperties,
		'design.customize.formatBackground': p.onToggleInspector,
	};
	const state = {
		editable: p.canEdit,
		galleryOpen: p.isThemeGalleryOpen,
		editorOpen: p.isThemeEditorOpen,
		backgroundOpen: p.isInspectorPaneOpen,
		hasSlideSize: Boolean(actions['design.customize.slideSize']),
		hasBackground: Boolean(p.onToggleInspector),
	};
	return (
		<>
			{DESIGN_RIBBON_GROUPS.map((group) => (
				<WebRibbonGroup key={group.id} groupId={group.id} label={t(group.labelKey)}>
					{DESIGN_RIBBON_COMMANDS.filter((command) => command.id.startsWith(`${group.id}.`)).map(
						(command) => {
							const view = designCommandState(command.id, state);
							return view.hidden ? null : (
								<WebRibbonCommand
									key={command.id}
									controlId={command.id}
									label={t(command.labelKey)}
									title={t(command.titleKey)}
									icon={command.icon}
									disabled={view.disabled}
									active={view.active}
									expanded={view.expanded}
									onCommand={() => actions[command.id as keyof typeof actions]?.()}
								/>
							);
						},
					)}
					{FIXED_TAB_GALLERIES.filter((placement) =>
						placement.control.startsWith(`${group.id}.`),
					).map((placement) => (
						<RibbonGallery
							key={placement.control}
							placement={placement}
							icon={placement.gallery === 'themeFonts' ? <LuType /> : <LuPalette />}
						/>
					))}
				</WebRibbonGroup>
			))}
		</>
	);
}

export { TransitionsSection } from './TransitionsSection';
export type { TransitionsSectionProps } from './TransitionsSection';
