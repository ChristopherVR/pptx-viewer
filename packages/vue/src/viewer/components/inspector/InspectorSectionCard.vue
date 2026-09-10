<script setup lang="ts">
/**
 * InspectorSectionCard: the bordered, optionally-titled wrapper every
 * `InspectorPane` section uses (Arrange, Fill, Line, Effects, ...).
 *
 * Pulled out of `InspectorPane.vue` (CLAUDE.md's 300 LOC file-size rule) so
 * that file stays thin presentation: each section becomes one
 * `<InspectorSectionCard>` tag instead of repeating the header/border markup.
 * `title` is optional because the Action Settings section renders with no
 * heading.
 */
defineProps<{
	title?: string;
}>();
</script>

<template>
	<div class="pptx-vue-inspector-section py-2 border-b border-border">
		<h3
			v-if="title"
			class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
		>
			{{ title }}
		</h3>
		<slot />
	</div>
</template>
