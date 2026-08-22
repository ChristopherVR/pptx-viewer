<script lang="ts">
	/**
	 * TextRunContent: a run's text content, honouring shared's per-script font
	 * split (`run.scriptRuns`) and measured tab-stop layout (`run.tabLines`)
	 * when either is present.
	 *
	 * Both descriptors come from `pptx-viewer-shared`'s `buildParagraphs` (the
	 * per-script split was React-only before this component existed: CJK,
	 * Arabic, Hebrew and Thai text rendered in the wrong typeface here; the tab
	 * layout was likewise React-only, so a TOC-style row lost its leader dots
	 * and right-aligned page number). Used inside `TextRun`'s span / anchor /
	 * ruby base text, so all three carry the same content logic.
	 */
	import type { ParagraphRun } from 'pptx-viewer-shared';

	import { styleToString } from '../style';

	const { run }: { run: ParagraphRun } = $props();
</script>

{#if run.tabLines}{#each run.tabLines as line, li (li)}<span
			style="display: inline-block; white-space: nowrap"
			>{#each line.pieces as piece, pi (pi)}{#if piece.leaderStyle}<span
						aria-hidden="true"
						style={styleToString(piece.leaderStyle)}>{piece.leaderText}</span
					>{/if}<span style={styleToString(piece.style)}>{piece.text}</span
				>{/each}</span
		>{#if li < run.tabLines.length - 1}<br />{/if}{/each}{:else if run.scriptRuns}{#each run.scriptRuns as piece, i (i)}{#if piece.style}<span
				style={styleToString(piece.style)}>{piece.text}</span
			>{:else}{piece.text}{/if}{/each}{:else}{run.text}{/if}
