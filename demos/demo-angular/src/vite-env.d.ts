// Minimal Vite env typing for the demo (tsconfig sets `types: []`, so the
// `vite/client` ambient types are not pulled in). Only the variables this demo
// reads are declared.
interface ImportMetaEnv {
	readonly VITE_COLLAB_SERVER_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
