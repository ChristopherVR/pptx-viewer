<script setup lang="ts">
/**
 * OptionsAddInsPane - Options > Add-ins: the viewer's optional capability
 * modules presented like PowerPoint's add-in inventory (grouped by active
 * state, details for the selected row). Vue counterpart of React's
 * `settings/OptionsAddInsPane.tsx`.
 */
import type { ViewerAddinStatus } from 'pptx-viewer-shared';
import { resolveViewerAddinRows } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	/** Host-supplied availability flags; unset ids default to active. */
	addinStatus?: ViewerAddinStatus;
}>();

const { t } = useI18n();

const selectedId = ref<string | null>(null);
const rows = computed(() => resolveViewerAddinRows(props.addinStatus));
const active = computed(() => rows.value.filter((row) => row.active));
const inactive = computed(() => rows.value.filter((row) => !row.active));
const selected = computed(() => rows.value.find((row) => row.id === selectedId.value));

const groups = computed(() => [
	{ title: t('pptx.options.addIns.active'), rows: active.value },
	{ title: t('pptx.options.addIns.inactive'), rows: inactive.value },
]);
</script>

<template>
	<div class="pptx-vue-options-addins space-y-4">
		<div
			class="grid grid-cols-[1fr_auto_auto] gap-x-2 border-b border-border pb-1 pl-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
		>
			<span>{{ t('pptx.options.addIns.name') }}</span>
			<span>{{ t('pptx.options.addIns.location') }}</span>
			<span>{{ t('pptx.options.addIns.type') }}</span>
		</div>

		<section v-for="group in groups" :key="group.title">
			<h4 class="mb-1 text-xs font-semibold text-foreground">{{ group.title }}</h4>
			<p v-if="group.rows.length === 0" class="px-2 py-1 text-xs italic text-muted-foreground">
				{{ t('pptx.options.addIns.description') }}
			</p>
			<table v-else class="w-full border-collapse text-left">
				<tbody>
					<tr
						v-for="row in group.rows"
						:key="row.id"
						class="cursor-pointer border-b border-border/40 transition-colors"
						:class="selectedId === row.id ? 'bg-primary/10' : 'hover:bg-accent'"
						@click="selectedId = row.id"
					>
						<td class="px-2 py-1.5 text-xs text-foreground">{{ t(row.nameKey) }}</td>
						<td class="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
							{{ row.location }}
						</td>
						<td class="px-2 py-1.5 text-xs text-muted-foreground">
							{{ t(`pptx.options.addInType.${row.type}`) }}
						</td>
					</tr>
				</tbody>
			</table>
		</section>

		<div v-if="selected" class="rounded border border-border/60 bg-muted/40 p-3">
			<p class="text-xs font-semibold text-foreground">{{ t(selected.nameKey) }}</p>
			<p class="mt-1 text-xs text-muted-foreground">{{ t(selected.descriptionKey) }}</p>
			<p class="mt-1 font-mono text-[11px] text-muted-foreground">{{ selected.location }}</p>
		</div>
	</div>
</template>
