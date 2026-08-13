<script setup lang="ts">
/**
 * CommentBody: renders a comment's text with its `@`-mentions highlighted.
 *
 * The split into text/mention runs is the shared decision function
 * `commentTextSegments`, so all five bindings produce identical runs. This SFC
 * only maps the resulting descriptor onto spans.
 */
import type { PptxComment } from 'pptx-viewer-core';
import {
	COMMENT_MENTION_ATTRIBUTE,
	COMMENT_MENTION_CLASS,
	commentTextSegments,
} from 'pptx-viewer-shared';
import { computed } from 'vue';

const props = defineProps<{
	text: string;
	mentions?: PptxComment['mentions'];
}>();

const segments = computed(() => commentTextSegments(props.text, props.mentions));
</script>

<template>
	<span>
		<template v-for="(segment, index) in segments" :key="index">
			<span
				v-if="segment.kind === 'mention'"
				:class="[COMMENT_MENTION_CLASS, 'rounded bg-primary/15 px-0.5 font-semibold text-primary']"
				v-bind="{ [COMMENT_MENTION_ATTRIBUTE]: segment.personId || '' }"
				:title="segment.authorName"
				>{{ segment.text }}</span
			>
			<template v-else>{{ segment.text }}</template>
		</template>
	</span>
</template>
