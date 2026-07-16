import type { BackstagePage } from 'pptx-viewer-shared';
import type { IconType } from 'react-icons';
import {
	LuDownload,
	LuFilePlus2,
	LuFolderOpen,
	LuHouse,
	LuInfo,
	LuPrinter,
	LuSave,
	LuSettings,
	LuShare2,
	LuUpload,
	LuUserRound,
	LuX,
} from 'react-icons/lu';

const ICONS: Partial<Record<BackstagePage, IconType>> = {
	home: LuHouse,
	new: LuFilePlus2,
	open: LuFolderOpen,
	info: LuInfo,
	save: LuSave,
	saveAs: LuDownload,
	print: LuPrinter,
	share: LuShare2,
	export: LuUpload,
	close: LuX,
	account: LuUserRound,
	options: LuSettings,
};

export function BackstageNavIcon({ page }: { page: BackstagePage }): React.ReactElement | null {
	const Icon = ICONS[page];
	return Icon ? <Icon className='size-[17px] shrink-0' aria-hidden='true' /> : null;
}
