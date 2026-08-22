<script setup lang="ts">
/**
 * SlideTextRunContent - a run's text content, honouring shared's per-script
 * font split (`run.scriptRuns`) and measured tab-stop layout (`run.tabLines`)
 * when either is present.
 *
 * Both descriptors come from `pptx-viewer-shared`'s `buildParagraphs` (the
 * per-script split was React-only before this component existed: CJK, Arabic,
 * Hebrew and Thai text rendered in the wrong typeface here; the tab layout was
 * likewise React-only, so a TOC-style row lost its leader dots and right-
 * aligned page number). Used inside `SlideTextRun`'s span / anchor / ruby base
 * text, so all three carry the same content logic.
 */
import type { ParagraphRun } from 'pptx-viewer-shared';

const props = defineProps<{ run: ParagraphRun }>();
</script>

<template>
	<template v-if="props.run.tabLines">
		<template v-for="(line, li) in props.run.tabLines" :key="`line-${li}`">
			<span style="display: inline-block; white-space: nowrap">
				<template v-for="(piece, pi) in line.pieces" :key="`p-${li}-${pi}`">
					<span v-if="piece.leaderStyle" aria-hidden="true" :style="piece.leaderStyle">{{
						piece.leaderText
					}}</span>
					<span :style="piece.style">{{ piece.text }}</span>
				</template>
			</span>
			<br v-if="li < props.run.tabLines.length - 1" />
		</template>
	</template>
	<template v-else-if="props.run.scriptRuns">
		<template v-for="(piece, i) in props.run.scriptRuns" :key="i">
			<span v-if="piece.style" :style="piece.style">{{ piece.text }}</span>
			<template v-else>{{ piece.text }}</template>
		</template>
	</template>
	<template v-else>{{ props.run.text }}</template>
</template>
