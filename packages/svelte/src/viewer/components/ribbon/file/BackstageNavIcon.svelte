<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Download from '@lucide/svelte/icons/download';
	import FilePlus2 from '@lucide/svelte/icons/file-plus-2';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Home from '@lucide/svelte/icons/home';
	import Info from '@lucide/svelte/icons/info';
	import Printer from '@lucide/svelte/icons/printer';
	import Save from '@lucide/svelte/icons/save';
	import Settings from '@lucide/svelte/icons/settings';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Upload from '@lucide/svelte/icons/upload';
	import UserRound from '@lucide/svelte/icons/user-round';
	import X from '@lucide/svelte/icons/x';
	import type { BackstagePage } from 'pptx-viewer-shared';
	import type { Component } from 'svelte';

	const { page }: { page: BackstagePage | 'back' } = $props();
	const icons = {
		back: ArrowLeft,
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
	} satisfies Record<BackstagePage | 'back', Component>;
	const Icon = $derived(icons[page]);
</script>

<Icon size={17} strokeWidth={1.7} aria-hidden="true" />
