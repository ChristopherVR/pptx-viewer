/* CSS side-effect imports (the library ships a plain stylesheet with no types). */
declare module 'pptx-vue-viewer/styles';
declare module '*.css';

/* SFC imports for the demo's own components. */
declare module '*.vue' {
	import type { DefineComponent } from 'vue';

	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
	export default component;
}
