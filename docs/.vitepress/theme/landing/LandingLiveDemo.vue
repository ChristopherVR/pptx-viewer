<script setup lang="ts">
import { ref } from 'vue';

import { useLandingCopy } from './copy';
import LiveDemoPane from './LiveDemoPane.vue';
import { DEMO_FRAMEWORKS, useLiveDemo } from './useLiveDemo';

/**
 * Live, embedded demo section: the deployed demo apps run inside the landing
 * page with a framework switcher, plus a collaboration mode that joins two
 * panes (host + guest, any framework pairing) to the same serverless
 * y-webrtc room so edits sync live inside the visitor's browser.
 */
const copy = useLandingCopy();
const section = ref<HTMLElement | null>(null);
const {
	started,
	mode,
	activeKey,
	guestKey,
	roomId,
	hostPane,
	guestPane,
	soloSrc,
	hostSrc,
	guestSrc,
	activeLabel,
	guestLabel,
	start,
	selectFramework,
	selectGuest,
	setMode,
} = useLiveDemo(section);
</script>

<template>
	<section id="live-demo" ref="section" class="pv-section pv-live">
		<p class="pv-kicker" data-reveal>{{ copy.demos.kicker }}</p>
		<h2 class="pv-h2" data-reveal="2">{{ copy.demos.title }}</h2>
		<p class="pv-copy" data-reveal="3">{{ copy.demos.copy }}</p>

		<div class="pv-live__controls" data-reveal="4">
			<div class="pv-live__tabs" role="tablist" :aria-label="copy.demos.frameworkLabel">
				<button
					v-for="f in DEMO_FRAMEWORKS"
					:key="f.key"
					type="button"
					role="tab"
					class="pv-live__tab"
					:class="{ 'is-active': f.key === activeKey }"
					:aria-selected="f.key === activeKey"
					@click="selectFramework(f.key)"
				>
					{{ f.label }}
				</button>
			</div>
			<div class="pv-live__modes">
				<button
					type="button"
					class="pv-live__tab"
					:class="{ 'is-active': mode === 'solo' }"
					@click="setMode('solo')"
				>
					{{ copy.demos.soloTab }}
				</button>
				<button
					type="button"
					class="pv-live__tab"
					:class="{ 'is-active': mode === 'collab' }"
					@click="setMode('collab')"
				>
					{{ copy.demos.collabTab }}
				</button>
			</div>
			<label v-if="mode === 'collab'" class="pv-live__guestpick">
				<span>{{ copy.demos.guestPicker }}</span>
				<select :value="guestKey" @change="selectGuest(($event.target as HTMLSelectElement).value)">
					<option
						v-for="f in DEMO_FRAMEWORKS"
						:key="f.key"
						:value="f.key"
						:disabled="f.key === activeKey"
					>
						{{ f.label }}
					</option>
				</select>
			</label>
		</div>

		<div v-if="!started" class="pv-live__poster" data-reveal="4">
			<button type="button" class="pv-btn pv-btn--solid" @click="start">
				<span>{{ copy.demos.load }}</span>
			</button>
		</div>
		<template v-else>
			<div v-if="mode === 'solo'" class="pv-live__stage">
				<LiveDemoPane
					:key="activeKey"
					:src="soloSrc"
					:title="`${activeLabel} · pptx-viewer live demo`"
					:caption="`${activeLabel} · sample-deck.pptx`"
					:open-label="copy.demos.openFull"
					:loading-label="copy.demos.loading"
				/>
			</div>
			<div v-else class="pv-live__stage pv-live__stage--split">
				<LiveDemoPane
					:key="`host-${roomId}`"
					ref="hostPane"
					:src="hostSrc"
					:title="`${activeLabel} · ${copy.demos.hostLabel}`"
					:caption="`${activeLabel} · ${copy.demos.hostLabel} · Ada`"
					:open-label="copy.demos.openFull"
					:loading-label="copy.demos.loading"
				/>
				<LiveDemoPane
					:key="`guest-${roomId}-${guestKey}`"
					ref="guestPane"
					:src="guestSrc"
					:title="`${guestLabel} · ${copy.demos.guestLabel}`"
					:caption="`${guestLabel} · ${copy.demos.guestLabel} · Grace`"
					:open-label="copy.demos.openFull"
					:loading-label="copy.demos.loading"
				/>
			</div>
			<p class="pv-live__hint">
				{{ mode === 'collab' ? copy.demos.collabHint : copy.demos.soloHint }}
			</p>
		</template>
	</section>
</template>

<style scoped>
.pv-live__controls {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.9rem 1.4rem;
	margin-top: 2.2rem;
}

.pv-live__tabs,
.pv-live__modes {
	display: inline-flex;
	flex-wrap: wrap;
	gap: 0.35rem;
	padding: 0.3rem;
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 6px;
}

.pv-live__modes {
	margin-left: auto;
}

.pv-live__tab {
	font-family: var(--pv-mono);
	font-size: 0.72rem;
	font-weight: 500;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--pv-ink-soft);
	padding: 0.5rem 0.9rem;
	border-radius: 4px;
	transition:
		color 0.25s ease,
		background-color 0.25s ease;
}

.pv-live__tab:hover {
	color: var(--pv-ink);
}

.pv-live__tab.is-active {
	background: var(--pv-accent-soft);
	color: var(--pv-accent);
}

.pv-live__guestpick {
	display: inline-flex;
	align-items: center;
	gap: 0.6rem;
	font-family: var(--pv-mono);
	font-size: 0.72rem;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--pv-ink-soft);
}

.pv-live__guestpick select {
	font-family: var(--pv-mono);
	font-size: 0.78rem;
	color: var(--pv-ink);
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 4px;
	padding: 0.45rem 0.6rem;
}

.pv-live__poster {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 340px;
	margin-top: 1.4rem;
	border: 1px dashed var(--pv-line);
	border-radius: 8px;
	background: var(--pv-surface);
}

.pv-live__stage {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	height: clamp(480px, 72vh, 760px);
	margin-top: 1.4rem;
}

.pv-live__stage--split {
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 1.1rem;
}

.pv-live__hint {
	margin-top: 1.1rem;
	font-size: 0.86rem;
	line-height: 1.65;
	color: var(--pv-ink-soft);
	max-width: 46rem;
}

@media (max-width: 1080px) {
	.pv-live__stage--split {
		grid-template-columns: minmax(0, 1fr);
		height: auto;
	}

	.pv-live__stage--split > * {
		height: clamp(420px, 60vh, 560px);
	}

	.pv-live__modes {
		margin-left: 0;
	}
}
</style>
