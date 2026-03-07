import { defineConfig } from "tsup";

export default defineConfig((options) => ({
	entry: [
		"src/index.ts",
		"src/viewer/index.ts",
	],
	format: ["esm", "cjs"],
	dts: true,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	external: [
		"react",
		"react-dom",
		"pptx-viewer-core",
		"framer-motion",
		"lucide-react",
		"react-icons",
		"html2canvas",
		"jspdf",
		"jszip",
		"fast-xml-parser",
		"clsx",
		"tailwind-merge",
		"i18next",
		"react-i18next",
	],
	treeshake: true,
	platform: "browser",
}));
