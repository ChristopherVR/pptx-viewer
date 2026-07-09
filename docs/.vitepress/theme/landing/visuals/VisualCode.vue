<template>
	<div class="pv-vcode">
		<div class="pv-vcode__bar">
			<span>round-trip.ts</span>
			<span class="pv-vcode__runtime">Node &middot; Bun &middot; Deno &middot; browser</span>
		</div>
		<pre><code><span class="k">import</span> { PptxHandler } <span class="k">from</span> <span class="s">'pptx-viewer-core'</span>;

<span class="k">const</span> handler = <span class="k">new</span> PptxHandler();
<span class="k">const</span> deck = <span class="k">await</span> handler.load(bytes);

<span class="c">// Every element is a typed, discriminated union</span>
<span class="k">for</span> (<span class="k">const</span> el <span class="k">of</span> deck.slides[0].elements) {
  <span class="k">if</span> (el.type === <span class="s">'text'</span>) el.text = rebrand(el.text);
}

<span class="c">// Serialize straight back to a valid .pptx</span>
<span class="k">const</span> file = <span class="k">await</span> handler.save(deck.slides);</code></pre>
	</div>
</template>

<style scoped>
.pv-vcode {
	background: #14171b;
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	overflow: hidden;
	box-shadow: var(--pv-shadow);
}

.dark .pv-vcode {
	background: #101317;
	border-color: #272c33;
}

.pv-vcode__bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 1rem;
	padding: 0.65rem 1.1rem;
	border-bottom: 1px solid rgba(240, 239, 236, 0.1);
	font-family: var(--pv-mono);
	font-size: 0.68rem;
	letter-spacing: 0.08em;
	color: rgba(240, 239, 236, 0.55);
}

.pv-vcode__runtime {
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: #e8916f;
}

.pv-vcode pre {
	margin: 0;
	padding: 1.3rem 1.4rem;
	overflow-x: auto;
}

.pv-vcode code {
	font-family: var(--pv-mono);
	font-size: 0.78rem;
	line-height: 1.75;
	color: #dfe3e8;
	background: none;
}

.pv-vcode .k {
	color: #e8916f;
}

.pv-vcode .s {
	color: #a8c795;
}

.pv-vcode .c {
	color: rgba(223, 227, 232, 0.4);
	font-style: italic;
}
</style>
