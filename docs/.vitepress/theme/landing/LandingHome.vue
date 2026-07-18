<script setup lang="ts">
import { ref } from 'vue';

import LandingAgents from './LandingAgents.vue';
import LandingDemos from './LandingDemos.vue';
import LandingFaq from './LandingFaq.vue';
import LandingFeatures from './LandingFeatures.vue';
import LandingFinale from './LandingFinale.vue';
import LandingHero from './LandingHero.vue';
import LandingQuickstart from './LandingQuickstart.vue';
import { useReveals } from './useReveals';

const root = ref<HTMLElement | null>(null);
useReveals(root);
</script>

<template>
	<div ref="root" class="pv-landing">
		<LandingHero />
		<LandingFeatures />
		<LandingAgents />
		<LandingQuickstart />
		<LandingDemos />
		<LandingFaq />
		<LandingFinale />
	</div>
</template>
