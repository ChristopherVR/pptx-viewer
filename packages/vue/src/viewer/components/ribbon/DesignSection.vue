<script setup lang="ts">
/**
 * DesignSection: the Vue 3 port of React's `DesignSection` from
 * `toolbar/DesignTransitionsReviewSection.tsx`. Renders the Design ribbon tab's
 * Themes (Browse/Edit Theme) and Customize (Slide Size / Format Background)
 * buttons. A faithful, mechanical port for visual + behavioral parity: class
 * strings are copied verbatim, callbacks arrive as function props.
 */
import { Monitor, PaintBucket, Palette, Pencil } from 'lucide-vue-next';

import { cn } from '../../../utils';
import { ics, pill, SEP } from './ribbon-constants';

interface Props {
	canEdit: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onOpenDocumentProperties?: () => void;
	onToggleInspector?: () => void;
	isInspectorPaneOpen?: boolean;
}

const props = defineProps<Props>();
</script>

<template>
	<!-- Themes -->
	<button
		:disabled="!props.canEdit"
		:class="cn(pill, props.isThemeGalleryOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Browse and apply built-in themes"
		@click="props.onToggleThemeGallery()"
	>
		<Palette :class="ics" />
		Browse Themes
	</button>
	<button
		:disabled="!props.canEdit"
		:class="cn(pill, props.isThemeEditorOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Edit presentation theme colors and fonts"
		@click="props.onToggleThemeEditor()"
	>
		<Pencil :class="ics" />
		Edit Theme
	</button>

	<div :class="SEP" />

	<!-- Customize -->
	<button
		v-if="props.onOpenDocumentProperties"
		:class="pill"
		title="Change slide dimensions (16:9, 4:3, custom)"
		@click="props.onOpenDocumentProperties()"
	>
		<Monitor :class="ics" />
		Slide Size
	</button>
	<button
		v-if="props.onToggleInspector"
		:class="cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Open inspector to edit slide background"
		@click="props.onToggleInspector()"
	>
		<PaintBucket :class="ics" />
		Format Background
	</button>
</template>
