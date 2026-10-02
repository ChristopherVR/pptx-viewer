import { RECORD_COMMAND_GROUPS } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { WebRibbonCommand, WebRibbonGroup } from './WebRibbonControls';

interface RecordSectionProps {
	onRecordFromBeginning: () => void;
	onRecordFromCurrent: () => void;
}
export function RecordSection(props: RecordSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const actions: Record<string, (() => void) | undefined> = {
		'record.record.fromBeginning': props.onRecordFromBeginning,
		'record.record.fromCurrent': props.onRecordFromCurrent,
	};
	return (
		<>
			{RECORD_COMMAND_GROUPS.map((group) => (
				<WebRibbonGroup key={group.id} label={t(group.labelKey)} groupId={group.id}>
					{group.commands.map((command) => (
						<WebRibbonCommand
							key={command.id}
							controlId={command.id}
							label={t(command.labelKey)}
							icon={command.icon}
							disabled={command.unsupported}
							onCommand={actions[command.id]}
						/>
					))}
				</WebRibbonGroup>
			))}
		</>
	);
}
