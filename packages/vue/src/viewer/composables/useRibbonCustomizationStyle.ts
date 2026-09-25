/**
 * Group- and control-level ribbon hiding for one viewer instance.
 *
 * The viewer root carries `data-pptx-ribbon-scope="<token>"` and renders one
 * `<style>` element ({@link RibbonCustomizationStyle}) whose text is the
 * shared `ribbonCustomizationCss(resolved, token)`, so the rules reach only
 * this viewer's ribbon and follow every customisation change. Which markup a
 * given id removes is decided in shared, from the `data-ribbon-group` /
 * `data-ribbon-control` tags the ribbon components carry.
 */
import { RIBBON_SCOPE_ATTR, ribbonCustomizationCss } from 'pptx-viewer-shared';
import type { ResolvedCustomization } from 'pptx-viewer-shared';
import { computed, defineComponent, h } from 'vue';
import type { ComputedRef, Ref } from 'vue';

let nextScope = 0;

export interface RibbonCustomizationScope {
	/** Spread onto the viewer root. */
	rootAttrs: Readonly<Record<typeof RIBBON_SCOPE_ATTR, string>>;
	/** The stylesheet text (empty when nothing is hidden). */
	css: ComputedRef<string>;
}

export function useRibbonCustomizationStyle(
	resolved: Ref<ResolvedCustomization>,
): RibbonCustomizationScope {
	nextScope += 1;
	const token = `pptx-vue-ribbon-${nextScope}`;
	return {
		rootAttrs: { [RIBBON_SCOPE_ATTR]: token },
		css: computed(() => ribbonCustomizationCss(resolved.value, token)),
	};
}

/**
 * Renders the scoped stylesheet. A render function because SFC templates
 * strip `<style>` tags.
 */
export const RibbonCustomizationStyle = defineComponent({
	name: 'RibbonCustomizationStyle',
	props: { css: { type: String, required: true } },
	setup(props) {
		return () => h('style', { 'data-pptx-ribbon-customization': '' }, props.css);
	},
});
