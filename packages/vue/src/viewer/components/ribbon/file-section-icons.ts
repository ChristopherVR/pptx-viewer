import {
	Download,
	FilePlus2,
	FolderOpen,
	Home,
	Info,
	Printer,
	Save,
	Settings,
	Share2,
	Upload,
	UserRound,
	X,
} from 'lucide-vue-next';
import type { BackstagePage } from 'pptx-viewer-shared';
import type { Component } from 'vue';

const ICONS: Partial<Record<BackstagePage, Component>> = {
	home: Home,
	new: FilePlus2,
	open: FolderOpen,
	info: Info,
	save: Save,
	saveAs: Download,
	print: Printer,
	share: Share2,
	export: Upload,
	close: X,
	account: UserRound,
	options: Settings,
};

export function backstageIcon(page: BackstagePage): Component | undefined {
	return ICONS[page];
}
