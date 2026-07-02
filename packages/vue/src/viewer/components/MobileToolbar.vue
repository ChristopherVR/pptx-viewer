<script setup lang="ts">
/**
 * MobileToolbar - Vue port of React's
 * `components/mobile/MobileToolbar.tsx`.
 *
 * Compact top row that replaces the desktop ribbon on a phone:
 *   menu - undo - redo - [spacer] - save - present - share
 *
 * All section-specific functionality (Home / Insert / Design / ...) lives in
 * the MobileMenuSheet opened by the hamburger button; the per-selection edit
 * actions live in the bottom bar. The menu button + sheet are gated on edit
 * mode, while Save + Present stay reachable even in view-only mode (mirrors
 * React).
 *
 * Conventions vs. React:
 *  - the aggregate `ToolbarProps` becomes our `RibbonProps` bundle (the same
 *    one the host assembles for the desktop ribbon),
 *  - `react-icons/lu` glyphs map to `lucide-vue-next`,
 *  - the section sheet's open state is owned here (local `ref`), exactly like
 *    React's `useState`.
 */
import { Download, Menu, Presentation, Redo, Share2, Undo } from 'lucide-vue-next';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../utils';
import MobileMenuSheet from './MobileMenuSheet.vue';
import type { RibbonProps } from './ribbon/ribbon-types';

interface Props extends RibbonProps {}

const props = defineProps<Props>();

const { t } = useI18n();

const menuOpen = ref(false);

/** Edit + master modes expose the editing controls (mirrors React's showEdit). */
const showEdit = (): boolean => props.mode === 'edit' || props.mode === 'master';

const BTN =
	'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-foreground/80 hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform';
</script>

<template>
	<div
		role="toolbar"
		:aria-label="t('pptx.mobileToolbar.toolbar')"
		class="relative z-20 flex min-h-[52px] items-center gap-1 border-b border-border bg-secondary/50 px-2 py-1 pt-[max(env(safe-area-inset-top),0px)]"
	>
		<!-- Menu (opens the section sheet) -->
		<button
			v-if="showEdit()"
			type="button"
			:class="BTN"
			:title="t('pptx.mobileMenu.title')"
			:aria-label="t('pptx.mobileMenu.title')"
			@click="menuOpen = true"
		>
			<Menu class="h-5 w-5" />
		</button>

		<!-- Undo / Redo -->
		<template v-if="showEdit()">
			<button
				type="button"
				:disabled="!props.canUndo"
				:class="BTN"
				:title="t('pptx.toolbar.undo')"
				:aria-label="t('pptx.toolbar.undo')"
				@click="props.onUndo()"
			>
				<Undo class="h-5 w-5" />
			</button>
			<button
				type="button"
				:disabled="!props.canRedo"
				:class="BTN"
				:title="t('pptx.toolbar.redo')"
				:aria-label="t('pptx.toolbar.redo')"
				@click="props.onRedo()"
			>
				<Redo class="h-5 w-5" />
			</button>
		</template>

		<div class="flex-1" />

		<!-- Save: reachable without digging into Menu, even in view-only mode -->
		<button
			type="button"
			:class="BTN"
			:title="t('pptx.comments.save')"
			:aria-label="t('pptx.comments.save')"
			@click="props.onSaveAsPptx()"
		>
			<Download class="h-5 w-5" />
		</button>

		<!-- Present -->
		<button
			type="button"
			:class="cn(BTN, 'text-primary')"
			:title="t('pptx.mobileBar.present')"
			:aria-label="t('pptx.mobileBar.present')"
			@click="props.onSetMode('present')"
		>
			<Presentation class="h-5 w-5" />
		</button>

		<!-- Share -->
		<button
			v-if="showEdit()"
			type="button"
			:class="cn(BTN, 'bg-primary px-3 text-white hover:bg-primary/90')"
			:title="t('pptx.toolbar.share')"
			:aria-label="t('pptx.toolbar.share')"
			@click="(props.onOpenShareDialog ?? props.onPackageForSharing)()"
		>
			<Share2 class="h-4 w-4" />
		</button>

		<!-- Section sheet -->
		<MobileMenuSheet v-bind="props" :open="menuOpen" @close="menuOpen = false" />
	</div>
</template>
