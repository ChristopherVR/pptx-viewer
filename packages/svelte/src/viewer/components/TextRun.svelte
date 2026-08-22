<script lang="ts">
	/**
	 * TextRun: one rendered run of a paragraph, plus its optional `a:reflection`
	 * mirrored-sibling wrapper.
	 *
	 * The run itself (equation / hyperlink / ruby / plain span) is
	 * `TextRunBase`. Reflection is wrapped HERE, around the whole base run,
	 * rather than inside each of `TextRunBase`'s branches: a `<ruby>` run's own
	 * `display: ruby` (which positions the annotation above its base text)
	 * would break if forced to `display: inline-block` to host an absolutely
	 * positioned mirror, so the positioning box has to be an outer element that
	 * leaves the base run's own tag untouched.
	 *
	 * Cross-browser (unlike the `-webkit-box-reflect` this replaced, which
	 * Firefox never implemented): the wrapper style comes from shared's
	 * `getTextReflectionWrapperStyle`, the text-run counterpart of a
	 * shape/picture's `ShapeEffectOverlay` reflection - reused, not forked.
	 */
	import type { CssStyleMap, ParagraphRun } from 'pptx-viewer-shared';

	import { styleToString } from '../style';
	import TextRunBase from './TextRunBase.svelte';
	import TextRunContent from './TextRunContent.svelte';

	const { run }: { run: ParagraphRun } = $props();
</script>

{#if run.reflection}<span style="position: relative; display: inline-block"
		><TextRunBase {run} /><span
			class="pptx-svelte-text-reflection"
			aria-hidden="true"
			style={styleToString(run.reflection as unknown as CssStyleMap)}
			><span style={styleToString(run.style)}><TextRunContent {run} /></span></span
		></span
	>{:else}<TextRunBase {run} />{/if}
