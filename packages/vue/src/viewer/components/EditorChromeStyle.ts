import { EDITOR_CHROME_CSS } from 'pptx-viewer-shared';
import { defineComponent, h } from 'vue';

export default defineComponent({
	name: 'EditorChromeStyle',
	setup: () => () => h('style', { 'data-pptx-editor-styles': '' }, EDITOR_CHROME_CSS),
});
