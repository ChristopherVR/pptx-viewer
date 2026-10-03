import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: { dedupe: ['yjs'] },
	test: { server: { deps: { inline: ['ooxml-core'] } } },
});
