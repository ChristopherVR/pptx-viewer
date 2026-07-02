<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ExportMenu: a small dropdown offering PNG (current slide), PDF, animated GIF
 * and WebM video exports. Emits intent; the host runs the actual export via
 * `useExport` / `useMediaExport`.
 */
defineProps<{ exporting: boolean }>();
const emit = defineEmits<{
	'export-png': [];
	'export-pdf': [];
	'export-gif': [];
	'export-webm': [];
}>();

const { t } = useI18n();

const open = ref(false);

function toggle(): void {
	open.value = !open.value;
}
function choose(kind: 'png' | 'pdf' | 'gif' | 'webm'): void {
	open.value = false;
	switch (kind) {
		case 'png':
			emit('export-png');
			return;
		case 'pdf':
			emit('export-pdf');
			return;
		case 'gif':
			emit('export-gif');
			return;
		case 'webm':
			emit('export-webm');
	}
}
</script>

<template>
	<div class="pptx-vue-export relative inline-flex" @focusout="open = false">
		<button
			type="button"
			class="pptx-vue-export-trigger inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-muted hover:bg-accent text-xs text-foreground transition-colors active:scale-95 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
			:disabled="exporting"
			aria-haspopup="menu"
			:aria-expanded="open"
			:title="exporting ? t('pptx.export.exporting') : t('pptx.export.export')"
			@click="toggle"
		>
			{{ exporting ? '…' : '⬇' }}
		</button>
		<div
			v-if="open"
			class="pptx-vue-export-menu absolute top-full right-0 z-50 mt-1 flex min-w-40 flex-col rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
			role="menu"
		>
			<button
				type="button"
				role="menuitem"
				class="block w-full rounded px-2.5 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
				@click="choose('png')"
			>
				{{ t('pptx.export.pngCurrentSlide') }}
			</button>
			<button
				type="button"
				role="menuitem"
				class="block w-full rounded px-2.5 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
				@click="choose('pdf')"
			>
				{{ t('pptx.export.pdfAllSlides') }}
			</button>
			<button
				type="button"
				role="menuitem"
				class="block w-full rounded px-2.5 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
				@click="choose('gif')"
			>
				{{ t('pptx.export.gifAnimated') }}
			</button>
			<button
				type="button"
				role="menuitem"
				class="block w-full rounded px-2.5 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
				@click="choose('webm')"
			>
				{{ t('pptx.export.webmVideo') }}
			</button>
		</div>
	</div>
</template>
