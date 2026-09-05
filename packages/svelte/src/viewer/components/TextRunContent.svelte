<script lang="ts">
	/**
	 * TextRunContent: a run's text content, honouring shared's per-script font
	 * split (`run.scriptRuns`), measured tab-stop layout (`run.tabLines`) and
	 * `u="words"` per-word underline pieces (`run.underlineWordPieces`, a ruby
	 * run; `piece.words`, a tab piece) when any is present.
	 *
	 * The descriptors come from `pptx-viewer-shared`'s `buildParagraphs` (the
	 * per-script split was React-only before this component existed: CJK,
	 * Arabic, Hebrew and Thai text rendered in the wrong typeface here; the tab
	 * layout was likewise React-only, so a TOC-style row lost its leader dots
	 * and right-aligned page number). Used inside `TextRun`'s span / anchor /
	 * ruby base text, so all three carry the same content logic.
	 */
	import type { ParagraphRun } from 'pptx-viewer-shared';

	import { styleToString } from '../style';

	const { run }: { run: ParagraphRun } = $props();
	const pieces = $derived(run.scriptRuns ?? run.underlineWordPieces);
</script>

{#if run.tabLines}{#each run.tabLines as line, li (li)}<span
			style="display: inline-block; white-space: nowrap"
			>{#each line.pieces as piece, pi (pi)}{#if piece.leaderStyle}<span
						aria-hidden="true"
						style={styleToString(piece.leaderStyle)}>{piece.leaderText}</span
					>{/if}{#if piece.words}{#each piece.words as word, wi (wi)}<span
							style={styleToString(word.style)}>{word.text}</span
						>{/each}{:else}<span style={styleToString(piece.style)}>{piece.text}</span
					>{/if}{/each}</span
		>{#if li < run.tabLines.length - 1}<br />{/if}{/each}{:else if pieces}{#each pieces as piece, i (i)}{#if piece.style}<span
				style={styleToString(piece.style)}>{piece.text}</span
			>{:else}{piece.text}{/if}{/each}{:else}{run.text}{/if}
