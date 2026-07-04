<script setup lang="ts">
import { Share2 } from 'lucide-vue-next';
/**
 * TabRowActions: Vue port of React's `toolbar/TabRowActions.tsx`.
 *
 * Right-side actions on the ribbon tab row (PowerPoint places Record and Share
 * there). Record starts rehearsal mode (records slide timings); Share turns
 * green while a collaboration session is connected.
 *
 * React reads the collaboration state from a `useCollaboration()` context; in
 * Vue collaboration is host-instantiated, so the connected state is threaded in
 * as `isCollaborating` / `collaboratorCount` props (surfaced through
 * `RibbonProps`).
 */
import { TAB_ROW_ACTION_CLASSES as TRA } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';

interface Props {
	onEnterRehearsalMode?: () => void;
	onOpenShareDialog?: () => void;
	onPackageForSharing?: () => void;
	isCollaborating?: boolean;
	collaboratorCount?: number;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<div class="flex items-center gap-1 pr-1">
		<button
			v-if="props.onEnterRehearsalMode"
			type="button"
			:class="TRA.record"
			:title="t('pptx.titleBar.record')"
			:aria-label="t('pptx.titleBar.record')"
			@click="props.onEnterRehearsalMode()"
		>
			<span :class="TRA.recordDot" aria-hidden="true" />
			<span>{{ t('pptx.titleBar.record') }}</span>
		</button>
		<button
			type="button"
			:class="
				cn(
					'relative inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors whitespace-nowrap',
					props.isCollaborating
						? 'bg-green-600 hover:bg-green-500 text-white'
						: 'bg-primary hover:bg-primary/90 text-white',
				)
			"
			:title="
				props.isCollaborating
					? t('pptx.toolbar.sharingUsers', { count: props.collaboratorCount ?? 0 })
					: t('pptx.toolbar.share')
			"
			:aria-label="t('pptx.toolbar.share')"
			@click="(props.onOpenShareDialog ?? props.onPackageForSharing)?.()"
		>
			<Share2 class="w-3 h-3" />
			<span>
				{{
					props.isCollaborating
						? t('pptx.toolbar.sharingCount', { count: props.collaboratorCount ?? 0 })
						: t('pptx.toolbar.share')
				}}
			</span>
		</button>
	</div>
</template>
