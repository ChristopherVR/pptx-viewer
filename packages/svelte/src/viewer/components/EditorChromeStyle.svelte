<script lang="ts">
	import { EDITOR_CHROME_CSS } from 'pptx-viewer-shared';

	const closingTag = ['<', '/style>'].join('');
	const markup = `<style data-pptx-editor-styles="">${EDITOR_CHROME_CSS}${closingTag}`;
</script>

<!-- Static repository CSS, bundled with every binding. -->
{@html markup}
