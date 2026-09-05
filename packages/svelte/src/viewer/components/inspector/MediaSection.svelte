<script lang="ts">
	import type { MediaCaptionTrack, MediaPptxElement, PptxElement } from 'pptx-viewer-core';
	import { mediaTrimEndAbsoluteMs, mediaTrimEndMsFromAbsoluteMs } from 'pptx-viewer-shared';

	import type { EditorState } from '../../editor/editor-state.svelte';
	import MediaTrimTimeline from './MediaTrimTimeline.svelte';
	import { resolveMediaPreviewUrl } from './media-preview';

	const { editor, mediaDataUrls = new Map() }: { editor: EditorState; mediaDataUrls?: Map<string, string> } = $props();
	const media = $derived(editor.selectedElement?.type === 'media' ? editor.selectedElement : undefined);
	const previewUrl = $derived(media ? resolveMediaPreviewUrl(media, mediaDataUrls) : undefined);
	// eslint-disable-next-line prefer-const
	let preview = $state<HTMLMediaElement>();
	// eslint-disable-next-line prefer-const
	let duration = $state(0);
	let currentTime = $state(0);
	// eslint-disable-next-line prefer-const
	let playing = $state(false);
	let bookmarkLabel = $state('');
	// eslint-disable-next-line prefer-const
	let bookmarkTime = $state(0);
	// G17/trim-end: `trimEndMs` is `p14:trim/@end`'s distance from the clip's
	// TAIL (COM-verified, see shared `media-trim-range.ts`), not an absolute
	// stop time. The raw "Trim end ms" field used to bind that distance
	// directly, so typing "the last 5s" of a 20s clip meant computing
	// 20000-5000 by hand; it now shows/accepts the absolute end position like
	// React's `MediaInspector` and Vue's `MediaPropertiesPanel.vue`.
	const durationMs = $derived(duration * 1000);
	const trimEndAbsoluteMs = $derived(media ? mediaTrimEndAbsoluteMs(durationMs, media.trimEndMs ?? 0) : 0);

	function patch(next: Partial<MediaPptxElement>): void {
		if (media) {
			editor.applyElementPatch(media.id, next as Partial<PptxElement>);
		}
	}
	function addBookmark(): void {
		if (!media) {
			return;
		}
		const label = bookmarkLabel.trim() || `Bookmark ${(media.bookmarks?.length ?? 0) + 1}`;
		patch({ bookmarks: [...(media.bookmarks ?? []), { id: `bookmark-${Date.now()}`, label, time: bookmarkTime }] });
		bookmarkLabel = '';
	}
	function addTrack(): void {
		if (!media) {
			return;
		}
		const count = media.captionTracks?.length ?? 0;
		patch({ captionTracks: [...(media.captionTracks ?? []), { id: `caption-${Date.now()}`, label: `Track ${count + 1}`, language: 'en', kind: 'subtitles', isDefault: count === 0 }] });
	}
	function trackPatch(index: number, next: Partial<MediaCaptionTrack>): void {
		if (media) {
			patch({ captionTracks: (media.captionTracks ?? []).map((track, i) => i === index ? { ...track, ...next } : track) });
		}
	}
	function togglePreview(): void {
		if (!preview) {
			return;
		}
		if (preview.paused) {
			void preview.play();
		} else {
			preview.pause();
		}
	}
	function seek(seconds: number): void {
		if (preview) {
			preview.currentTime = seconds;
		}
		currentTime = seconds;
	}
</script>

{#if media}<div class="section">
	{#if previewUrl}<div class="preview">{#if media.mediaType === 'video'}<video bind:this={preview} src={previewUrl} preload="metadata" onloadedmetadata={() => (duration = preview && Number.isFinite(preview.duration) ? preview.duration : 0)} ontimeupdate={() => { if (preview) currentTime = preview.currentTime; }} onplay={() => (playing = true)} onpause={() => (playing = false)}><track kind="captions" label="Captions" src="data:text/vtt;charset=utf-8,WEBVTT" />{#each media.captionTracks ?? [] as track}<track kind={track.kind === 'subtitles' ? 'subtitles' : 'captions'} label={track.label} srclang={track.language} src={track.src ?? `data:text/vtt;charset=utf-8,${encodeURIComponent(track.content ?? 'WEBVTT')}`} default={track.isDefault} />{/each}</video>{:else}<audio bind:this={preview} src={previewUrl} preload="metadata" onloadedmetadata={() => (duration = preview && Number.isFinite(preview.duration) ? preview.duration : 0)} ontimeupdate={() => { if (preview) currentTime = preview.currentTime; }} onplay={() => (playing = true)} onpause={() => (playing = false)}></audio>{/if}<button type="button" onclick={togglePreview}>{playing ? 'Pause' : 'Play'}</button><span>{currentTime.toFixed(1)} / {duration.toFixed(1)}s</span>{#if duration > 0}<MediaTrimTimeline {duration} startMs={media.trimStartMs ?? 0} endMs={media.trimEndMs} {currentTime} bookmarks={media.bookmarks ?? []} onchange={(trimStartMs, trimEndMs) => patch({ trimStartMs, trimEndMs })} onseek={seek} />{/if}</div>{/if}
	<div class="checks"><label><input type="checkbox" checked={media.autoPlay ?? false} onchange={(event) => patch({ autoPlay: event.currentTarget.checked })} />Auto play</label><label><input type="checkbox" checked={media.loop ?? false} onchange={(event) => patch({ loop: event.currentTarget.checked })} />Loop</label><label><input type="checkbox" checked={media.fullScreen ?? false} onchange={(event) => patch({ fullScreen: event.currentTarget.checked })} />Full screen</label><label><input type="checkbox" checked={media.playAcrossSlides ?? false} onchange={(event) => patch({ playAcrossSlides: event.currentTarget.checked, ...(event.currentTarget.checked ? { autoPlay: true } : {}) })} />Across slides</label><label><input type="checkbox" checked={media.hideWhenNotPlaying ?? false} onchange={(event) => patch({ hideWhenNotPlaying: event.currentTarget.checked })} />Hide when stopped</label></div>
	<label>Volume <input type="range" min="0" max="1" step="0.05" value={media.volume ?? 1} oninput={(event) => patch({ volume: Number(event.currentTarget.value) })} /></label>
	<label>Speed <select aria-label="Speed" value={media.playbackSpeed ?? 1} onchange={(event) => patch({ playbackSpeed: Number(event.currentTarget.value) })}>{#each [0.25,0.5,0.75,1,1.25,1.5,2,3,4] as speed}<option value={speed}>{speed}x</option>{/each}</select></label>
	<div class="grid"><label>Trim start ms<input type="number" min="0" value={media.trimStartMs ?? 0} onchange={(event) => patch({ trimStartMs: Number(event.currentTarget.value) })} /></label><label>Trim end ms<input type="number" min="0" value={trimEndAbsoluteMs} onchange={(event) => patch({ trimEndMs: event.currentTarget.value === '' ? undefined : mediaTrimEndMsFromAbsoluteMs(durationMs, Number(event.currentTarget.value)) })} /></label><label>Fade in seconds<input type="number" min="0" step="0.1" value={media.fadeInDuration ?? 0} onchange={(event) => patch({ fadeInDuration: Number(event.currentTarget.value) || undefined })} /></label><label>Fade out seconds<input type="number" min="0" step="0.1" value={media.fadeOutDuration ?? 0} onchange={(event) => patch({ fadeOutDuration: Number(event.currentTarget.value) || undefined })} /></label></div>
	<details open><summary>Bookmarks</summary>{#each [...(media.bookmarks ?? [])].sort((a,b)=>a.time-b.time) as bookmark}<div class="row"><input value={bookmark.label} onchange={(event) => patch({bookmarks:(media.bookmarks??[]).map((item)=>item.id===bookmark.id?{...item,label:event.currentTarget.value}:item)})} /><input type="number" min="0" step="0.1" value={bookmark.time} onchange={(event) => patch({bookmarks:(media.bookmarks??[]).map((item)=>item.id===bookmark.id?{...item,time:Number(event.currentTarget.value)}:item)})} /><button aria-label="Remove bookmark" onclick={() => patch({bookmarks:(media.bookmarks??[]).filter((item)=>item.id!==bookmark.id)})}>×</button></div>{/each}<div class="row"><input placeholder="Bookmark label" bind:value={bookmarkLabel} /><input type="number" min="0" step="0.1" bind:value={bookmarkTime} /><button aria-label="Add bookmark" onclick={addBookmark}>+</button></div></details>
	<details open><summary>Caption tracks</summary>{#each media.captionTracks ?? [] as track, index}<fieldset><div class="grid"><label>Label<input value={track.label} onchange={(event)=>trackPatch(index,{label:event.currentTarget.value})} /></label><label>Language<input value={track.language} onchange={(event)=>trackPatch(index,{language:event.currentTarget.value})} /></label><label>Kind<select aria-label="Kind" value={track.kind} onchange={(event)=>trackPatch(index,{kind:event.currentTarget.value as MediaCaptionTrack['kind']})}><option>subtitles</option><option>captions</option><option>descriptions</option></select></label><label class="inline"><input type="checkbox" checked={track.isDefault ?? false} onchange={(event)=>patch({captionTracks:(media.captionTracks??[]).map((item,i)=>({...item,isDefault:event.currentTarget.checked?i===index:(i===index?false:item.isDefault)}))})} />Default</label></div><label>Source<input value={track.src ?? ''} placeholder="captions.vtt or data URL" onchange={(event)=>trackPatch(index,{src:event.currentTarget.value||undefined})} /></label><label>Inline WebVTT<textarea rows="4" value={track.content ?? ''} onchange={(event)=>trackPatch(index,{content:event.currentTarget.value||undefined})}></textarea></label><button onclick={() => patch({captionTracks:(media.captionTracks??[]).filter((_item,i)=>i!==index)})}>Remove track</button></fieldset>{/each}<button onclick={addTrack}>Add caption track</button></details>
</div>{/if}

<style>.section{display:grid;gap:8px}.preview{display:grid;grid-template-columns:auto 1fr;gap:5px;align-items:center}.preview video,.preview audio{grid-column:1/-1;width:100%;max-height:130px;background:#000}.preview :global(.timeline),.preview :global(.times){grid-column:1/-1}.checks,.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.checks label,.inline{display:flex;align-items:center}label{display:grid;gap:3px;color:var(--pptx-muted-foreground);font-size:10px}input,select,textarea{min-width:0;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}input,select{height:25px}.row{display:grid;grid-template-columns:1fr 70px 28px;gap:4px;margin-top:5px}details{border-top:1px solid var(--pptx-border);padding-top:7px}summary{cursor:pointer;font-weight:600}fieldset{display:grid;gap:6px;margin:6px 0;padding:6px;border:1px solid var(--pptx-border);border-radius:6px}button{border:1px solid var(--pptx-border);border-radius:5px;padding:4px 7px;background:var(--pptx-muted);color:inherit}</style>
