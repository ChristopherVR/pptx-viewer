<script lang="ts">
	import type { CompareController } from '../compare/compare-controller.svelte';
	import { useTranslator } from '../../i18n/context';

	const { compare, onclose }: { compare: CompareController; onclose: () => void } = $props();
	const t = useTranslator();
	const diffs = $derived(compare.result?.diffs.filter((diff) => diff.status !== 'unchanged') ?? []);
	function resultIndex(diff: (typeof diffs)[number]): number { return compare.result?.diffs.indexOf(diff) ?? -1; }
</script>
{#if compare.result}
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<aside class="panel" role="dialog" tabindex="-1" aria-labelledby="compare-title"><header><div><h2 id="compare-title">{t('pptx.compare.title')}</h2><p>{t('pptx.compare.summary', { added: compare.result.addedCount, removed: compare.result.removedCount, changed: compare.result.changedCount })}</p></div><button type="button" aria-label={t('pptx.compare.close')} onclick={onclose}>×</button></header>
	{#if diffs.length}<div class="actions"><button type="button" onclick={() => compare.acceptAll()}>✓ {t('pptx.compare.acceptAll')}</button></div>{/if}
	<div class="list">{#if !diffs.length}<p class="empty">{t('pptx.compare.noDifferences')}</p>{:else}{#each diffs as diff}<article><div class="summary"><span class:added={diff.status === 'added'} class:removed={diff.status === 'removed'}>{t(`pptx.compare.status${diff.status[0].toUpperCase()}${diff.status.slice(1)}`)}</span><strong>{t('pptx.compare.slideNumber', { number: Math.max(diff.baseIndex, diff.compareIndex) + 1 })}</strong></div>{#if diff.changes.length}<ul>{#each diff.changes as change}<li>{change.description}</li>{/each}</ul>{/if}<footer><button class:chosen={compare.rejected.has(resultIndex(diff))} onclick={() => compare.reject(resultIndex(diff))}>× {t('pptx.compare.reject')}</button><button class="accept" class:chosen={compare.accepted.has(resultIndex(diff))} onclick={() => compare.accept(resultIndex(diff))}>✓ {t('pptx.compare.accept')}</button></footer></article>{/each}{/if}</div>
	</aside>
{/if}
<style>
	.panel{position:fixed;inset:0 0 0 auto;z-index:1000;display:flex;width:min(440px,100vw);flex-direction:column;border-left:1px solid var(--pptx-border,#3f3f52);background:var(--pptx-card,#1e1e2e);box-shadow:-18px 0 50px #0007}header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2,header p{margin:0}h2{font-size:14px}header p{margin-top:3px;color:var(--pptx-muted-foreground,#94a3b8);font-size:11px}header button{border:0;background:transparent;color:inherit;font-size:20px}.actions{padding:9px 16px;border-bottom:1px solid var(--pptx-border,#3f3f52)}button{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:6px 10px;background:var(--pptx-muted,#2a2a3d);color:inherit}.actions button,.accept{border-color:#238636;background:#17682b;color:#fff}.list{display:grid;gap:9px;overflow:auto;padding:12px;flex:1}.empty{text-align:center;color:var(--pptx-muted-foreground,#94a3b8);font-size:12px}article{height:max-content;border:1px solid var(--pptx-border,#3f3f52);border-radius:8px;background:var(--pptx-background,#11111b)}.summary{display:flex;align-items:center;gap:8px;padding:10px}.summary span{border-radius:4px;padding:2px 5px;background:#9a670055;color:#f2cc60;font-size:10px;text-transform:uppercase}.summary .added{background:#23863655;color:#7ee787}.summary .removed{background:#da363355;color:#ff7b72}.summary strong{font-size:12px}ul{margin:0;padding:0 28px 8px;color:var(--pptx-muted-foreground,#94a3b8);font-size:11px}footer{display:flex;justify-content:flex-end;gap:7px;padding:8px;border-top:1px solid var(--pptx-border,#3f3f52)}.chosen{box-shadow:0 0 0 2px var(--pptx-ring,#818cf8)}
</style>
