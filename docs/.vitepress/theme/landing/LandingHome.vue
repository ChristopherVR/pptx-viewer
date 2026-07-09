<script setup lang="ts">
import { ref } from 'vue';

import LandingBento from './LandingBento.vue';
import LandingFinale from './LandingFinale.vue';
import LandingHero from './LandingHero.vue';
import LandingSections from './LandingSections.vue';
import LandingStack from './LandingStack.vue';
import LandingStatement from './LandingStatement.vue';
import { useReveals } from './useReveals';

const root = ref<HTMLElement | null>(null);
useReveals(root);
</script>

<template>
	<div ref="root" class="pv-landing">
		<LandingHero />
		<LandingStatement />
		<LandingSections />
		<LandingBento />
		<LandingStack />
		<LandingFinale />
	</div>
</template>
