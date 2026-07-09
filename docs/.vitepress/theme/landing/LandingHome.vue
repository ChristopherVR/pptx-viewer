<script setup lang="ts">
import { ref } from 'vue';

import LandingBento from './LandingBento.vue';
import LandingFinale from './LandingFinale.vue';
import LandingHero from './LandingHero.vue';
import LandingMarquee from './LandingMarquee.vue';
import LandingSections from './LandingSections.vue';
import LandingStack from './LandingStack.vue';
import LandingStatement from './LandingStatement.vue';
import { useSlideDeck } from './useSlideDeck';

const root = ref<HTMLElement | null>(null);
const { current, total, progress } = useSlideDeck(root);
</script>

<template>
	<div ref="root" class="pv-landing">
		<LandingHero />
		<LandingMarquee />
		<LandingStatement />
		<LandingSections />
		<LandingBento />
		<LandingStack />
		<LandingFinale />

		<div class="pv-presenter" aria-hidden="true">
			<span class="pv-presenter__counter">{{ current }} / {{ total }}</span>
			<span class="pv-presenter__track">
				<i :style="{ transform: `scaleX(${progress})` }"></i>
			</span>
		</div>
	</div>
</template>
