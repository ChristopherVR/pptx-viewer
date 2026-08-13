<script setup lang="ts">
/**
 * FontFamilyMenu: the Home tab's font dropdown, grouped the way PowerPoint
 * groups it (theme fonts, fonts embedded in the deck, fonts added this
 * session, then the full catalogue). Vue port of React's
 * `toolbar/FontFamilyMenu.tsx`.
 *
 * Every row previews itself in its own family, so the list can be scanned by
 * shape rather than by name. The grouping and de-duplication rules live in
 * `pptx-viewer-shared` so all five bindings show the same list.
 */
import { buildFontCatalog } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { MENU_PANEL } from './ribbon-constants';

const props = defineProps<{
	/** Theme major/minor latin faces, shown first and labelled by role. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds via `p:embeddedFontLst`. */
	embeddedFonts?: readonly string[];
	/** Families registered this session from File > Options > Fonts. */
	customFonts?: readonly string[];
}>();

const emit = defineEmits<{ (event: 'select', family: string): void }>();

const { t } = useI18n();

const groups = computed(() =>
	buildFontCatalog({
		themeFonts: props.themeFonts,
		embeddedFonts: props.embeddedFonts,
		customFonts: props.customFonts,
	}),
);
</script>

<template>
	<div class="absolute left-0 top-full z-50 flex flex-col w-64 pt-1" data-testid="font-family-menu">
		<div :class="MENU_PANEL">
			<template v-for="(group, groupIndex) in groups" :key="group.id">
				<div
					class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
					:class="groupIndex > 0 ? 'border-t border-border/60 mt-1' : ''"
				>
					{{ t(group.labelKey) }}
				</div>
				<button
					v-for="entry in group.entries"
					:key="`${group.id}-${entry.family}`"
					type="button"
					class="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					:style="{ fontFamily: entry.family }"
					@click="emit('select', entry.family)"
				>
					<span class="truncate">{{ entry.family }}</span>
					<span v-if="entry.themeRole" class="shrink-0 text-[10px] text-muted-foreground">
						{{ t(`pptx.font.role.${entry.themeRole}`) }}
					</span>
				</button>
			</template>
		</div>
	</div>
</template>
