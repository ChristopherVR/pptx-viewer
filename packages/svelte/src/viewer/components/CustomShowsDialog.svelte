<script lang="ts">
	import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core'; import { untrack } from 'svelte'; import { useTranslator } from '../../i18n/context';

	const { shows, slides, activeShowId = null, onclose, onsave, onsetactive }: { shows: PptxCustomShow[]; slides: PptxSlide[];
		/** The show playback is currently restricted to, or null for the whole deck. */
		activeShowId?: string | null;
		onclose: () => void; onsave: (shows: PptxCustomShow[]) => void;
		/**
		 * Restrict (or, with null, stop restricting) the slide show to one show.
		 * Without this the dialog defined shows nothing could ever select, so a
		 * custom show had no effect on what actually presented.
		 */
		onsetactive?: (id: string | null) => void } = $props(); const t = useTranslator();
	let draft = $state<PptxCustomShow[]>(structuredClone(untrack(() => shows))); let selected = $state(0); let newName = $state('');
	/** The picker's value. '' means "All Slides", i.e. no restriction. */
	let active = $state<string>(untrack(() => activeShowId) ?? '');
	function setActive(next: string): void { active = next; onsetactive?.(next || null); }
	/**
	 * Commit the draft, then re-point the restriction. A show deleted in this
	 * session must not leave playback pinned to an id nothing resolves.
	 */
	function save(): void {
		// `$state.snapshot`, not the draft itself: `draft` is a deep reactive proxy,
		// and the editor's `updateCustomShows` `structuredClone`s what it is handed.
		// Cloning a proxy throws DataCloneError, so Save has never actually saved.
		onsave($state.snapshot(draft) as PptxCustomShow[]);
		onsetactive?.(draft.some(({ id }) => id === active) ? active : null);
		onclose();
	}
	function create(): void { const name = newName.trim(); if (!name) {return;} draft = [...draft, { id: `${Date.now()}`, name, slideRIds: [] }]; selected = draft.length - 1; newName = ''; }
	function toggle(rId: string): void { const show = draft[selected]; if (!show) {return;} const has = show.slideRIds.includes(rId); draft = draft.map((item, i) => i === selected ? { ...item, slideRIds: has ? item.slideRIds.filter((id) => id !== rId) : [...item.slideRIds, rId] } : item); }
</script>
<div class="backdrop"><!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role --><section role="dialog" tabindex="-1" aria-modal="true" aria-label={t('pptx.customShows.title')}><header><h2>{t('pptx.customShows.title')}</h2><button onclick={onclose}>×</button></header><div class="active-picker"><span>{t('pptx.customShows.selectCustomShow')}</span><select aria-label={t('pptx.customShows.selectCustomShow')} value={active} onchange={(event) => setActive(event.currentTarget.value)}><option value="">{t('pptx.customShows.allSlides')}</option>{#each draft as show (show.id)}<option value={show.id}>{show.name}</option>{/each}</select></div><div class="body"><aside>{#each draft as show, index}<button class:active={selected === index} onclick={() => (selected = index)}><span>{show.name}</span><small>{t('pptx.customShows.slideCount', { count: show.slideRIds.length })}</small></button>{:else}<p>{t('pptx.customShows.empty')}</p>{/each}<div class="new"><input placeholder={t('pptx.customShows.namePlaceholder')} bind:value={newName} /><button onclick={create}>+</button></div>{#if draft[selected]}<button class="delete" onclick={() => { draft = draft.filter((_show, index) => index !== selected); selected = Math.max(0, selected - 1); }}>{t('pptx.customShows.delete')}</button>{/if}</aside><main>{#if draft[selected]}<h3>{draft[selected].name}</h3>{#each slides as slide, index}<label><input type="checkbox" checked={draft[selected].slideRIds.includes(slide.rId)} onchange={() => toggle(slide.rId)} /><span>{t('pptx.compare.slideNumber', { number: index + 1 })}</span></label>{/each}{:else}<p>{t('pptx.customShows.noSlidesYet')}</p>{/if}</main></div><footer><button onclick={onclose}>{t('pptx.customShows.cancel')}</button><button class="primary" onclick={save}>{t('pptx.customShows.save')}</button></footer></section></div>
<style>
	.backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:#0009}section{width:min(680px,calc(100vw - 32px));max-height:85vh;overflow:hidden;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e)}header,footer{display:flex;align-items:center;justify-content:space-between;padding:13px 17px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2,h3,p{margin:0}h2{font-size:14px}.active-picker{display:flex;align-items:center;gap:8px;padding:10px 17px;border-bottom:1px solid var(--pptx-border,#3f3f52);font-size:12px}.active-picker select{min-width:0;flex:1}.body{display:grid;grid-template-columns:220px 1fr;min-height:360px}.body aside{padding:12px;border-right:1px solid var(--pptx-border,#3f3f52)}aside>button{display:grid;width:100%;gap:2px;border:0;border-radius:6px;padding:8px;background:transparent;color:inherit;text-align:left}aside>button.active{background:var(--pptx-muted,#2a2a3d)}small{color:var(--pptx-muted-foreground,#94a3b8)}.new{display:flex;margin-top:10px}.new input{min-width:0;flex:1}.delete{margin-top:8px;color:#f87171}.body main{display:grid;align-content:start;gap:7px;overflow:auto;padding:18px}.body main label{display:flex;gap:8px;padding:7px;border-radius:5px;background:var(--pptx-muted,#2a2a3d);font-size:12px}button,input{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:7px;background:var(--pptx-muted,#2a2a3d);color:inherit}header button{border:0;background:transparent;font-size:20px}footer{justify-content:flex-end;gap:8px;border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}.primary{background:var(--pptx-primary,#c43b32);color:#fff}@media(max-width:600px){section{position:fixed;inset:auto 0 0;width:100%;max-height:88dvh}.body{grid-template-columns:1fr}.body aside{border-right:0;border-bottom:1px solid var(--pptx-border,#3f3f52)}}
</style>
