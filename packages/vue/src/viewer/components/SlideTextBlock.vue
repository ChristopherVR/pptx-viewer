<script setup lang="ts">
/**
 * SlideTextBlock - renders an element's rich text as paragraphs of styled runs
 * with bullet markers + hanging indents. The paragraph model is built by the
 * shared, framework-agnostic `buildParagraphs`; this component is pure
 * presentation. Extracted from `ElementRenderer` to keep it thin.
 */
import { buildTextBuildSpec, textBuildSpanStyle } from 'pptx-viewer-shared';
import type { ElementAnimationState, RenderParagraph } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { CSSProperties } from 'vue';

/** A run whose text is exactly a newline is a hard line break, not content. */
const NEWLINE_RUN = '\n';

const props = defineProps<{
	paragraphs: RenderParagraph[];
	textStyle: CSSProperties;
	/** Owning element id, needed to key this element's text-build sub-animations. */
	elementId?: string;
	/**
	 * Live per-sub-element animation states. Present only while a staged text
	 * build (by paragraph / word / letter) is playing; absent everywhere else,
	 * which is why the fast path below returns `undefined` immediately.
	 */
	subElementAnimStates?: ReadonlyMap<string, ElementAnimationState>;
}>();

/**
 * The split for a paragraph whose text is being revealed piece by piece, or
 * `undefined` to render the runs normally. PowerPoint's "Animate text: By
 * letter" needs the rendered text split to match the per-character
 * sub-animations, otherwise the whole box just fades as one.
 */
const specs = computed(() =>
	props.paragraphs.map((para, paraIndex) =>
		props.elementId
			? buildTextBuildSpec(
					props.elementId,
					paraIndex,
					para.runs.filter((run) => run.text !== NEWLINE_RUN),
					props.subElementAnimStates,
				)
			: undefined,
	),
);

/**
 * Per-paragraph inline style: hanging-indent margins plus the paragraph's own
 * line spacing (`a:lnSpc`) and space-before/after (`a:spcBef`/`a:spcAft`),
 * carried on the shared {@link RenderParagraph} model. Undefined spacing keys
 * are omitted so the body-level `line-height` (on the text block) still applies.
 */
function paraStyle(para: RenderParagraph): CSSProperties {
	return {
		marginTop: para.spaceBeforePx !== undefined ? `${para.spaceBeforePx}px` : 0,
		marginRight: 0,
		marginBottom: para.spaceAfterPx !== undefined ? `${para.spaceAfterPx}px` : 0,
		marginLeft: para.marginLeftPx !== undefined ? `${para.marginLeftPx}px` : 0,
		textIndent: para.textIndentPx !== undefined ? `${para.textIndentPx}px` : undefined,
		lineHeight: para.lineHeight,
		// Re-base the line box on this paragraph's own runs; every run span
		// carries an explicit font-size, so this only moves the CSS strut.
		fontSize: para.strutFontSizePx !== undefined ? `${para.strutFontSizePx}px` : undefined,
	};
}
</script>

<template>
	<div class="pptx-vue-text" :style="textStyle">
		<p v-for="(para, pi) in paragraphs" :key="pi" class="pptx-vue-para" :style="paraStyle(para)">
			<img
				v-if="para.bulletPicture?.src"
				class="pptx-vue-bullet-image"
				:src="para.bulletPicture.src"
				:alt="para.bulletPicture.accessibleLabel"
				:style="{
					width: `${para.bulletPicture.sizePx}px`,
					height: `${para.bulletPicture.sizePx}px`,
					display: 'inline-block',
					verticalAlign: 'middle',
					marginInlineEnd: '4px',
					objectFit: 'contain',
				}"
			/>
			<span
				v-else-if="para.bulletMarker !== undefined"
				class="pptx-vue-bullet"
				:style="para.bulletStyle"
				:aria-label="para.bulletPicture?.accessibleLabel"
				>{{ para.bulletMarker }}</span
			>
			<!-- Staged text build (by paragraph / word / letter): render the split
			     pieces so each one carries its own sub-animation. -->
			<template v-if="specs[pi]">
				<span
					v-if="specs[pi]!.granularity === 'paragraph'"
					:data-anim-id="specs[pi]!.animId"
					:style="textBuildSpanStyle(specs[pi]!)"
				>
					<template v-for="(run, ri) in para.runs" :key="ri">
						<br v-if="run.text === '\n'" />
						<span v-else :style="run.style">{{ run.text }}</span>
					</template>
				</span>
				<span
					v-for="(span, si) in specs[pi]!.spans ?? []"
					v-else
					:key="si"
					:data-anim-id="span.animId"
					:style="{ ...(span.style ?? {}), ...textBuildSpanStyle(span) }"
					>{{ span.text }}</span
				>
			</template>
			<template v-for="(run, ri) in para.runs" v-else :key="ri">
				<br v-if="run.text === '\n'" />
				<span v-else :style="run.style">{{ run.text }}</span>
			</template>
			<!-- An authored blank line has no runs, so without this the <p>
			     collapses to zero height and the gap a deck puts between a
			     heading and its bullet list disappears (issue #131). -->
			<br v-if="para.isEmpty" />
		</p>
	</div>
</template>
