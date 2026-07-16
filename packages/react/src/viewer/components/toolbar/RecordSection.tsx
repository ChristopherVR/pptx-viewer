import React from 'react';
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
	return (
		<>
			<RibbonGroup label='Camera'>
				<RibbonCommand icon={<LuCamera />} label='Cameo' disabled />
			</RibbonGroup>
			<RibbonGroup label='Record'>
				<RibbonCommand icon={<LuVideo />} label='From Beginning' onClick={onRecordFromBeginning} />
				<RibbonCommand icon={<LuPlay />} label='From Current Slide' onClick={onRecordFromCurrent} />
			</RibbonGroup>
			<RibbonGroup label='Manage'>
				<RibbonCommand icon={<LuEraser />} label='Clear' disabled />
				<RibbonCommand icon={<LuRotateCcw />} label='Reset to Cameo' disabled />
			</RibbonGroup>
			<RibbonGroup label='Help'>
				<RibbonCommand icon={<LuCircleHelp />} label='Learn More' disabled />
			</RibbonGroup>
		</>
	);
}
