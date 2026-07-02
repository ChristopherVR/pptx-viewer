<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';

/**
 * FontEmbeddingPanel: toggle font embedding on save and preview which of the
 * presentation's used fonts are available locally / already embedded. Vue port
 * of the React `FontEmbeddingPanel.tsx`. Availability is detected with the
 * browser `document.fonts` API when the dialog opens.
 */
const props = defineProps<{
	open: boolean;
	embedFontsEnabled: boolean;
	usedFontFamilies: string[];
	embeddedFonts: string[];
}>();

const emit = defineEmits<{
	toggleEmbedFonts: [enabled: boolean];
	close: [];
}>();

const availableFamilies = ref<Set<string>>(new Set());
const scanning = ref(false);
const scanned = ref(false);

function checkFontAvailable(family: string): boolean {
	if (typeof document === 'undefined') {
		return false;
	}
	try {
		return document.fonts.check(`12px "${family}"`);
	} catch {
		return false;
	}
}

async function scanFonts(): Promise<void> {
	scanning.value = true;
	try {
		await document.fonts.ready;
		const found = new Set<string>();
		for (const family of props.usedFontFamilies) {
			if (checkFontAvailable(family)) {
				found.add(family);
			}
		}
		availableFamilies.value = found;
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
	<ModalDialog :open="props.open" title="Embed Fonts" @close="emit('close')">
		<div class="space-y-4">
			<p class="text-xs text-muted-foreground">
				Embed the fonts used in this presentation so it looks the same on machines that do not have
				them installed.
			</p>

			<label class="flex cursor-pointer items-center gap-3">
				<div class="relative">
					<input
						type="checkbox"
						class="sr-only"
						:checked="props.embedFontsEnabled"
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
				<span class="text-xs text-foreground">Embed fonts in the file</span>
			</label>

			<div class="space-y-1">
				<h3 class="text-xs font-medium text-foreground">
					Used fonts ({{ props.usedFontFamilies.length }})
				</h3>
				<div v-if="scanning" class="flex items-center justify-center gap-2 py-4">
					<span class="text-xs text-muted-foreground">Scanning available fonts...</span>
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
								Embedded
							</span>
							<span v-if="availableFamilies.has(family)" class="text-[10px] text-green-400">
								Available
							</span>
							<span v-else class="text-[10px] text-yellow-400">Not found</span>
						</div>
					</div>
					<p
						v-if="props.usedFontFamilies.length === 0"
						class="px-3 py-2 text-xs italic text-muted-foreground"
					>
						No custom fonts detected in this presentation.
					</p>
				</div>
			</div>

			<p v-if="missingCount > 0 && !scanning" class="text-[11px] text-yellow-400/80">
				{{ missingCount }} font(s) are not available locally and may not render exactly.
			</p>
		</div>

		<template #footer>
			<button
				type="button"
				class="rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/80"
				@click="emit('close')"
			>
				Done
			</button>
		</template>
	</ModalDialog>
</template>
