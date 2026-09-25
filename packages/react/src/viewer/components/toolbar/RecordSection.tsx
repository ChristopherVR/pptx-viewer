import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuCamera, LuCircleHelp, LuEraser, LuPlay, LuRotateCcw, LuVideo } from 'react-icons/lu';

import { RibbonCommand, RibbonGroup } from './PowerPointRibbonControls';

interface RecordSectionProps {
	onRecordFromBeginning: () => void;
	onRecordFromCurrent: () => void;
}

export function RecordSection({
	onRecordFromBeginning,
	onRecordFromCurrent,
}: RecordSectionProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<>
			<RibbonGroup label={t('pptx.record.camera')} groupId='record.camera'>
				<RibbonCommand
					controlId='record.camera.cameo'
					icon={<LuCamera />}
					label={t('pptx.record.cameo')}
					disabled
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.ribbon.tab.record')} groupId='record.record'>
				<RibbonCommand
					controlId='record.record.fromBeginning'
					icon={<LuVideo />}
					label={t('pptx.slideShow.fromBeginning')}
					onClick={onRecordFromBeginning}
				/>
				<RibbonCommand
					icon={<LuPlay />}
					controlId='record.record.fromCurrent'
					label={t('pptx.slideShow.fromCurrent')}
					onClick={onRecordFromCurrent}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.record.manage')} groupId='record.manage'>
				<RibbonCommand
					controlId='record.manage.clear'
					icon={<LuEraser />}
					label={t('pptx.record.clear')}
					disabled
				/>
				<RibbonCommand
					controlId='record.manage.reset'
					icon={<LuRotateCcw />}
					label={t('pptx.record.resetToCameo')}
					disabled
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.ribbon.tab.help')} groupId='record.help'>
				<RibbonCommand
					controlId='record.help.learnMore'
					icon={<LuCircleHelp />}
					label={t('pptx.record.learnMore')}
					disabled
				/>
			</RibbonGroup>
		</>
	);
}
