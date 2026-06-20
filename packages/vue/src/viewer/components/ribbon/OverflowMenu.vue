<script setup lang="ts">
/**
 * OverflowMenu: the Vue 3 port of React's `toolbar/OverflowMenu.tsx`. Renders
 * the "More actions" ellipsis button and its popover, driven by the OV table.
 * A faithful, mechanical port for visual + behavioral parity: class strings are
 * copied verbatim, open state stays prop-driven (`isOverflowMenuOpen` /
 * `onSetOverflowMenuOpen`) exactly as React, and each OV key maps to its handler.
 */
import { Ellipsis } from 'lucide-vue-next';

import { cn } from '../../../utils';
import { ic, ics, OV } from './ribbon-constants';
import type { RibbonProps } from './ribbon-types';

interface Props extends RibbonProps {}

const props = defineProps<Props>();

function ovAct(k: string): void {
	props.onSetOverflowMenuOpen(false);
	const handlers: Record<string, (() => void) | undefined> = {
		png: props.onExportPng,
		pdf: props.onExportPdf,
		video: props.onExportVideo,
		gif: props.onExportGif,
		package: props.onPackageForSharing,
		pptx: props.onSaveAsPptx,
		ppsx: props.onSaveAsPpsx,
		pptm: props.onSaveAsPptm,
		print: props.onPrint,
		copyImg: props.onCopySlideAsImage,
		a11y: props.onRunAccessibilityCheck,
		shortcuts: props.onToggleShortcuts,
		versionHistory: props.onToggleVersionHistory,
		documentProperties: props.onOpenDocumentProperties,
		passwordProtection: props.onOpenPasswordProtection,
		fontEmbedding: props.onOpenFontEmbedding,
		digitalSignatures: props.onOpenDigitalSignatures,
	};
	handlers[k]?.();
}
</script>

<template>
	<div class="relative">
		<button
			type="button"
			:class="
				cn(
					'p-1.5 rounded transition-colors',
					props.isOverflowMenuOpen ? 'bg-primary/80 text-white' : 'bg-muted hover:bg-accent',
				)
			"
			title="More actions"
			aria-label="More actions"
			@click="props.onSetOverflowMenuOpen(!props.isOverflowMenuOpen)"
		>
			<Ellipsis :class="ic" />
		</button>
		<template v-if="props.isOverflowMenuOpen">
			<button
				type="button"
				class="fixed inset-0 z-40"
				aria-label="Close menu"
				@click="props.onSetOverflowMenuOpen(false)"
			/>
			<div
				class="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1"
			>
				<template v-for="o in OV.filter((o) => o.k !== 'pptm' || props.hasMacros)" :key="o.k">
					<div v-if="o.k.startsWith('---')" class="my-1 border-t border-border/60" />
					<button
						v-else
						type="button"
						class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
						@click="ovAct(o.k)"
					>
						<component :is="o.icon" v-if="o.icon" :class="ics + ' text-muted-foreground'" />
						{{ o.l }}
					</button>
				</template>
			</div>
		</template>
	</div>
</template>
