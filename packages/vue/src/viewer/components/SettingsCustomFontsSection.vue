<script setup lang="ts">
/**
 * File > Options > General > Fonts. Vue port of React's
 * `SettingsCustomFontsSection.tsx`.
 *
 * Lets the user hand a local font file to the viewer so a deck authored with a
 * font the browser lacks renders with the real face instead of a substitute.
 * Opt-in, and deliberately session-scoped: the file is added to the page's
 * font set and nothing is uploaded or written into the presentation.
 */
import { Upload } from 'lucide-vue-next';
import { CUSTOM_FONT_ACCEPT, registerCustomFont } from 'pptx-viewer-shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
	/** Mirrors `general.enableCustomFontUpload`; the picker stays inert when off. */
	enabled: boolean;
	/** Families registered so far this session. */
	families: readonly string[];
}>();

const emit = defineEmits<{ (event: 'registered', family: string): void }>();

const { t } = useI18n();
const inputRef = ref<HTMLInputElement | null>(null);
const failed = ref(false);

async function handleFile(file: File): Promise<void> {
	failed.value = false;
	try {
		const registration = await registerCustomFont(file);
		if (registration) {
			emit('registered', registration.family);
		} else {
			// Either the environment has no FontFace support, or the filename
			// reduced to nothing usable once its style tokens were stripped.
			failed.value = true;
		}
	} catch {
		failed.value = true;
	}
}

function onChange(event: Event): void {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	// Clear the value so re-picking the same file fires change again.
	input.value = '';
	if (file) {
		void handleFile(file);
	}
}
</script>

<template>
	<div class="mt-2">
		<button
			type="button"
			:disabled="!enabled"
			class="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
			@click="inputRef?.click()"
		>
			<Upload class="h-3.5 w-3.5" />
			{{ t('pptx.options.general.addFontFile') }}
		</button>
		<input
			ref="inputRef"
			type="file"
			:accept="CUSTOM_FONT_ACCEPT"
			class="hidden"
			@change="onChange"
		/>

		<p v-if="!enabled" class="mt-2 text-xs text-muted-foreground">
			{{ t('pptx.options.general.customFontsDisabled') }}
		</p>
		<p v-if="failed" role="alert" class="mt-2 text-xs text-destructive">
			{{ t('pptx.options.general.customFontError') }}
		</p>

		<p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.options.general.customFontsAdded') }}
		</p>
		<p v-if="families.length === 0" class="mt-1 text-xs text-muted-foreground">
			{{ t('pptx.options.general.customFontsEmpty') }}
		</p>
		<ul v-else class="mt-1 flex flex-col gap-0.5">
			<li
				v-for="family in families"
				:key="family"
				class="text-xs text-foreground"
				:style="{ fontFamily: family }"
			>
				{{ family }}
			</li>
		</ul>
	</div>
</template>
