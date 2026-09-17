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
			<RibbonGroup label={t('pptx.record.camera')}>
				<RibbonCommand icon={<LuCamera />} label={t('pptx.record.cameo')} disabled />
			</RibbonGroup>
			<RibbonGroup label={t('pptx.ribbon.tab.record')}>
				<RibbonCommand
					icon={<LuVideo />}
					label={t('pptx.slideShow.fromBeginning')}
					onClick={onRecordFromBeginning}
				/>
				<RibbonCommand
					icon={<LuPlay />}
					label={t('pptx.slideShow.fromCurrent')}
					onClick={onRecordFromCurrent}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.record.manage')}>
				<RibbonCommand icon={<LuEraser />} label={t('pptx.record.clear')} disabled />
				<RibbonCommand icon={<LuRotateCcw />} label={t('pptx.record.resetToCameo')} disabled />
			</RibbonGroup>
			<RibbonGroup label={t('pptx.ribbon.tab.help')}>
				<RibbonCommand icon={<LuCircleHelp />} label={t('pptx.record.learnMore')} disabled />
			</RibbonGroup>
		</>
	);
}
