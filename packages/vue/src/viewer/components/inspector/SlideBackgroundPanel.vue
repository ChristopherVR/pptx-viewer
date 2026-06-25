<script setup lang="ts">
/**
 * SlideBackgroundPanel: per-slide background editing (Vue port of the non-
 * template part of React's `SlideBackgroundPanel`). Edits the active slide's
 * solid colour and background image, and clears the background.
 *
 * Emits `update` with a `Partial<PptxSlide>` patch; the host (SlideInspector ->
 * PowerPointViewer) applies it to the active slide with history. The template /
 * master background controls are not ported (they require template-edit mode).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{ slide: PptxSlide | undefined; canEdit?: boolean }>(), {
	canEdit: true,
});

const emit = defineEmits<{ update: [patch: Partial<PptxSlide>] }>();

const fileInput = ref<HTMLInputElement | null>(null);

const colorValue = computed(() => props.slide?.backgroundColor ?? '#ffffff');
const backgroundImage = computed(() => props.slide?.backgroundImage);
const hasBackground = computed(() =>
	Boolean(
		props.slide?.backgroundColor || props.slide?.backgroundImage || props.slide?.backgroundGradient,
	),
);

function onColorChange(event: Event): void {
	emit('update', { backgroundColor: (event.target as HTMLInputElement).value });
}

function onImageChange(event: Event): void {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) {
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		if (typeof reader.result === 'string') {
			emit('update', { backgroundImage: reader.result });
		}
	};
	reader.readAsDataURL(file);
}

function removeImage(): void {
	emit('update', { backgroundImage: undefined });
}

function clearBackground(): void {
	emit('update', {
		backgroundColor: undefined,
		backgroundImage: undefined,
		backgroundGradient: undefined,
	});
}
</script>

<template>
	<div class="space-y-2">
		<label class="flex items-center gap-2 text-[11px]">
			<span class="w-10 shrink-0 text-muted-foreground">Colour</span>
			<input
				type="color"
				:value="colorValue"
				:disabled="!canEdit"
				class="h-6 w-8 cursor-pointer rounded border border-border bg-muted"
				aria-label="Slide background colour"
				@change="onColorChange"
			/>
			<span class="truncate text-[10px] text-muted-foreground">{{
				slide?.backgroundColor || 'none'
			}}</span>
		</label>

		<div class="space-y-1">
			<div class="flex items-center gap-2 text-[11px]">
				<span class="w-10 shrink-0 text-muted-foreground">Image</span>
				<input
					ref="fileInput"
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
					class="hidden"
					:disabled="!canEdit"
					@change="onImageChange"
				/>
				<button
					type="button"
					class="flex-1 rounded border border-border bg-muted px-2 py-1 text-center text-[11px] hover:bg-accent disabled:opacity-50"
					:disabled="!canEdit"
					@click="fileInput?.click()"
				>
					{{ backgroundImage ? 'Replace Image' : 'Choose Image' }}
				</button>
			</div>
			<div v-if="backgroundImage" class="relative mt-1">
				<img
					:src="backgroundImage"
					alt="Background preview"
					class="h-16 w-full rounded border border-border object-cover"
				/>
				<button
					type="button"
					class="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5 text-[10px] transition-colors hover:bg-red-700 disabled:opacity-50"
					:disabled="!canEdit"
					title="Remove background image"
					aria-label="Remove background image"
					@click="removeImage"
				>
					X
				</button>
			</div>
		</div>

		<button
			v-if="hasBackground"
			type="button"
			class="w-full rounded border border-border bg-muted px-2 py-1 text-center text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50"
			:disabled="!canEdit"
			@click="clearBackground"
		>
			Clear Background
		</button>
	</div>
</template>
