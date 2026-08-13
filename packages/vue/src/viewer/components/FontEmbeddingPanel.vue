<script setup lang="ts">
import { scanAvailableFontFamilies } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

/**
 * FontEmbeddingPanel: toggle font embedding on save and preview which of the
 * presentation's used fonts are available locally / already embedded. Vue port
 * of the React `FontEmbeddingPanel.tsx`. Availability is detected with the
 * browser `document.fonts` API when the dialog opens.
 */
const props = withDefaults(
	defineProps<{
		open: boolean;
		embedFontsEnabled: boolean;
		usedFontFamilies: string[];
		embeddedFonts: string[];
		/**
		 * False when the deck embeds nothing, in which case the switch is inert
		 * and says why. The viewer can keep or strip embedded font data on save,
		 * but it cannot manufacture it: a browser will not hand over the bytes of
		 * an installed system face.
		 */
		canEmbedFonts?: boolean;
		/** i18n key for the explanation shown when `canEmbedFonts` is false. */
		embedUnavailableKey?: string;
	}>(),
	{ canEmbedFonts: true, embedUnavailableKey: undefined },
);

const emit = defineEmits<{
	toggleEmbedFonts: [enabled: boolean];
	close: [];
}>();

const { t } = useI18n();

const availableFamilies = ref<Set<string>>(new Set());
const scanning = ref(false);
const scanned = ref(false);

async function scanFonts(): Promise<void> {
	scanning.value = true;
	try {
		availableFamilies.value = await scanAvailableFontFamilies(props.usedFontFamilies);
		scanned.value = true;
	} catch {
		// silently fail; families stay marked as not found
	} finally {
		scanning.value = false;
	}
}

watch(
	() => props.open,
	(open) => {
		if (open && !scanned.value) {
			void scanFonts();
		}
	},
	{ immediate: true },
);

const embeddedSet = computed(() => new Set(props.embeddedFonts));
const missingCount = computed(
	() => props.usedFontFamilies.filter((f) => !availableFamilies.value.has(f)).length,
);
</script>

<template>
	<ModalDialog :open="props.open" :title="t('pptx.fontEmbedding.title')" @close="emit('close')">
		<div class="space-y-4">
			<p class="text-xs text-muted-foreground">
				{{ t('pptx.fontEmbedding.description') }}
			</p>

			<label
				class="flex items-center gap-3"
				:class="props.canEmbedFonts ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'"
			>
				<div class="relative">
					<input
						type="checkbox"
						class="sr-only"
						:checked="props.embedFontsEnabled"
						:disabled="!props.canEmbedFonts"
						@change="emit('toggleEmbedFonts', ($event.target as HTMLInputElement).checked)"
					/>
					<div
						class="h-5 w-9 rounded-full transition-colors"
						:class="props.embedFontsEnabled ? 'bg-primary' : 'bg-muted-foreground'"
					/>
					<div
						class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
						:class="props.embedFontsEnabled ? 'translate-x-4' : ''"
					/>
				</div>
				<span class="text-xs text-foreground">{{ t('pptx.fontEmbedding.embedInFile') }}</span>
			</label>
			<!--
				The switch used to move and change nothing at all. It now decides
				whether save keeps the deck's embedded font data, so it has to say
				which of those two things it is doing - and admit when it can do
				neither.
			-->
			<p class="text-[11px] text-muted-foreground">
				{{
					props.canEmbedFonts
						? t('pptx.fonts.embedKeepsExisting')
						: t(props.embedUnavailableKey ?? 'pptx.fonts.embedUnavailable')
				}}
			</p>

			<div class="space-y-1">
				<h3 class="text-xs font-medium text-foreground">
					{{ t('pptx.fontEmbedding.usedFonts', { count: props.usedFontFamilies.length }) }}
				</h3>
				<div v-if="scanning" class="flex items-center justify-center gap-2 py-4">
					<span class="text-xs text-muted-foreground">{{ t('pptx.fontEmbedding.scanning') }}</span>
				</div>
				<div v-else class="max-h-[280px] space-y-1 overflow-y-auto">
					<div
						v-for="family in props.usedFontFamilies"
						:key="family"
						class="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2"
					>
						<span class="text-xs text-foreground">{{ family }}</span>
						<div class="flex items-center gap-2">
							<span
								v-if="embeddedSet.has(family)"
								class="rounded border border-green-700/40 bg-green-900/40 px-1.5 py-0.5 text-[10px] text-green-400"
							>
								{{ t('pptx.fontEmbedding.embedded') }}
							</span>
							<span v-if="availableFamilies.has(family)" class="text-[10px] text-green-400">
								{{ t('pptx.fontEmbedding.available') }}
							</span>
							<span v-else class="text-[10px] text-yellow-400">{{
								t('pptx.fontEmbedding.notFound')
							}}</span>
						</div>
					</div>
					<p
						v-if="props.usedFontFamilies.length === 0"
						class="px-3 py-2 text-xs italic text-muted-foreground"
					>
						{{ t('pptx.fontEmbedding.noCustomFonts') }}
					</p>
				</div>
			</div>

			<p v-if="missingCount > 0 && !scanning" class="text-[11px] text-yellow-400/80">
				{{ t('pptx.fontEmbedding.missingWarning', { count: missingCount }) }}
			</p>
		</div>

		<template #footer>
			<button
				type="button"
				class="rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/80"
				@click="emit('close')"
			>
				{{ t('pptx.fontEmbedding.done') }}
			</button>
		</template>
	</ModalDialog>
</template>
