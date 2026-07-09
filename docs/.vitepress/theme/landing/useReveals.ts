import type { Ref } from 'vue';
import { onBeforeUnmount, onMounted } from 'vue';

/** Reveals [data-reveal] elements inside root as they enter the viewport. */
export function useReveals(root: Ref<HTMLElement | null>) {
	let observer: IntersectionObserver | undefined;

	onMounted(() => {
		const el = root.value;
		if (!el) {
			return;
		}
		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}
					entry.target.classList.add('is-revealed');
					observer?.unobserve(entry.target);
				}
			},
			{ threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
		);
		el.querySelectorAll('[data-reveal]').forEach((node) => observer?.observe(node));
	});

	onBeforeUnmount(() => {
		observer?.disconnect();
	});
}
