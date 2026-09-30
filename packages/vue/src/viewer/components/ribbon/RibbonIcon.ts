import { RIBBON_CONTROL_ICONS } from 'pptx-viewer-shared';
import type { RibbonIconNode } from 'pptx-viewer-shared';
import { defineComponent, h } from 'vue';
import type { VNode } from 'vue';

function renderNode(node: RibbonIconNode): VNode {
	return h(node.tag, node.attrs, node.children?.map(renderNode) ?? node.text);
}

/** Vue only renders the shared ribbon artwork. */
export default defineComponent({
	props: { name: { type: String, required: true } },
	setup(props) {
		return () => {
			const icon = RIBBON_CONTROL_ICONS[props.name];
			return h('svg', { ...icon.attrs, 'aria-hidden': 'true' }, icon.children.map(renderNode));
		};
	},
});
