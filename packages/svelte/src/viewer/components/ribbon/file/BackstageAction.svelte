<script lang="ts">
	import type { Component } from 'svelte';

	const { icon: Icon, title, body, onclick }: {
		icon: Component;
		title: string;
		body: string;
		onclick: () => void;
	} = $props();
</script>

<button type="button" {onclick}>
	<b><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></b>
	<span><strong>{title}</strong><small>{body}</small></span>
</button>

<style>
	button{display:flex;min-height:112px;gap:16px;padding:20px;border:1px solid var(--pptx-border,#ddd);background:var(--pptx-card,#fff);text-align:left;color:var(--pptx-card-foreground,#242424)}
	button:hover{border-color:var(--pptx-primary,#c43e1c);box-shadow:0 5px 15px #0002}
	b{display:grid;width:40px;height:40px;flex:none;place-items:center;background:var(--pptx-accent,#fbe9e3);color:var(--pptx-primary,#c43e1c)}
	strong,small{display:block;font-size:15px}
	small{margin-top:7px;color:var(--pptx-muted-foreground,#666);font-size:12px;line-height:1.5}
</style>
