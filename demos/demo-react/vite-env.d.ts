/// <reference types="vite/client" />

interface ImportMetaEnv {
	/**
	 * Optional collaboration server URL baked in at build time. When set (e.g.
	 * on a deployed origin), the demo defaults the Share dialog to this y-websocket
	 * relay. Should be a secure `wss://` URL when the demo is served over https.
	 */
	readonly VITE_COLLAB_SERVER_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
