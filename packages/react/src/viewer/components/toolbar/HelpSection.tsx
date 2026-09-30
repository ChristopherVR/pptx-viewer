import { HELP_RIBBON_COMMANDS, isDialogAvailable } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useViewerCustomizationContext } from '../viewer-customization-context';
import { WebRibbonCommand, WebRibbonGroup } from './WebRibbonControls';

export interface HelpSectionProps {
	/** Opens Options, or the shortcuts sheet when the host does not wire Options. */
	onOpenSettings?: () => void;
	onToggleShortcuts: () => void;
	onRunAccessibilityCheck: () => void;
}

export function HelpSection(p: HelpSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const showSettings = isDialogAvailable(useViewerCustomizationContext(), 'options');
	const actions = {
		'help.help.options': p.onOpenSettings ?? p.onToggleShortcuts,
		'help.help.keyboardShortcuts': p.onToggleShortcuts,
		'help.help.accessibility': p.onRunAccessibilityCheck,
	};
	return (
		<WebRibbonGroup label={t('pptx.ribbon.tab.help')} groupId='help.help'>
			{HELP_RIBBON_COMMANDS.filter(
				(command) => command.id !== 'help.help.options' || showSettings,
			).map((command) => (
				<WebRibbonCommand
					key={command.id}
					controlId={command.id}
					label={t(command.labelKey)}
					icon={command.icon}
					compact
					onCommand={() => actions[command.id as keyof typeof actions]()}
				/>
			))}
		</WebRibbonGroup>
	);
}
