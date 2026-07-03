/**
 * collab-server.example.mjs
 *
 * Self-hosted collaboration relay for pptx-viewer's websocket transport,
 * speaking the y-websocket wire protocol (sync + awareness), with the two
 * production concerns the library cannot solve client-side built in:
 *
 *  - AUTH: clients send `authToken` in CollaborationConfig; every binding
 *    forwards it as a `?token=` query parameter on the websocket handshake.
 *    The server rejects the connection with 401 before the upgrade when the
 *    token is not in the allowlist.
 *  - PERSISTENCE: each room's Y.Doc is loaded from disk on first join and
 *    snapshotted (debounced, plus on last disconnect) so documents survive
 *    server restarts.
 *
 * Zero npm installs inside this repo: it runs on Bun's built-in websocket
 * server and the yjs / y-protocols / lib0 packages already present.
 *
 * Run (from the repo root):
 *   COLLAB_AUTH_TOKENS=secret1,secret2 bun demos/collab-server.example.mjs
 *
 * Environment:
 *   PORT                websocket port (default 1234)
 *   COLLAB_AUTH_TOKENS  comma-separated allowed tokens. UNSET = auth is
 *                       DISABLED (open relay) - fine for local dev only.
 *   COLLAB_DATA_DIR     snapshot directory (default ./collab-data).
 *                       Set to '-' to disable persistence.
 *
 * Then point every viewer client at:
 *   serverUrl: 'ws://localhost:1234'
 *   roomId:    '<document-id>'
 *   authToken: 'secret1'
 *
 * Production notes: terminate TLS in front of this (wss://), prefer
 * short-lived per-user tokens minted by your app server over a static shared
 * secret (swap `isAuthorized` for a JWT verify), and keep the data dir on
 * durable storage.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const PORT = Number(process.env.PORT ?? 1234);
const AUTH_TOKENS = new Set(
	(process.env.COLLAB_AUTH_TOKENS ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean),
);
const DATA_DIR = process.env.COLLAB_DATA_DIR ?? './collab-data';
const PERSIST = DATA_DIR !== '-';
// Matches the sanitization the viewer applies to room ids.
const ROOM_NAME_RE = /^[A-Za-z0-9_-]{1,128}$/u;
const SAVE_DEBOUNCE_MS = 2000;
const PING_INTERVAL_MS = 30_000;

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

if (PERSIST) {
	mkdirSync(DATA_DIR, { recursive: true });
}

/** @typedef {{ doc: Y.Doc, awareness: awarenessProtocol.Awareness, conns: Map<object, Set<number>>, name: string, saveTimer: ReturnType<typeof setTimeout> | undefined, dirty: boolean }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();

const snapshotPath = (name) => join(DATA_DIR, `${name}.yjs`);

/** @param {Room} room */
function saveRoom(room) {
	if (!PERSIST || !room.dirty) {
		return;
	}
	clearTimeout(room.saveTimer);
	room.saveTimer = undefined;
	const bytes = Y.encodeStateAsUpdate(room.doc);
	const path = snapshotPath(room.name);
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, bytes);
	renameSync(tmp, path);
	room.dirty = false;
	console.log(`[collab] saved "${room.name}" (${bytes.length} bytes)`);
}

/** @param {Room} room */
function scheduleSave(room) {
	if (!PERSIST) {
		return;
	}
	room.dirty = true;
	clearTimeout(room.saveTimer);
	room.saveTimer = setTimeout(() => saveRoom(room), SAVE_DEBOUNCE_MS);
}

/** @param {Room} room @param {Uint8Array} buf */
function broadcast(room, buf) {
	for (const conn of room.conns.keys()) {
		conn.send(buf);
	}
}

/** @param {string} name @returns {Room} */
function getRoom(name) {
	let room = rooms.get(name);
	if (room) {
		return room;
	}
	const doc = new Y.Doc();
	if (PERSIST && existsSync(snapshotPath(name))) {
		Y.applyUpdate(doc, new Uint8Array(readFileSync(snapshotPath(name))));
		console.log(`[collab] restored "${name}" from disk`);
	}
	const awareness = new awarenessProtocol.Awareness(doc);
	awareness.setLocalState(null);
	room = { doc, awareness, conns: new Map(), name, saveTimer: undefined, dirty: false };

	doc.on('update', (update) => {
		const enc = encoding.createEncoder();
		encoding.writeVarUint(enc, MESSAGE_SYNC);
		syncProtocol.writeUpdate(enc, update);
		broadcast(room, encoding.toUint8Array(enc));
		scheduleSave(room);
	});

	awareness.on('update', ({ added, updated, removed }, origin) => {
		const changed = added.concat(updated, removed);
		// Track which awareness client ids each socket controls so they can be
		// cleaned up when that socket disconnects.
		const controlled = room.conns.get(origin);
		if (controlled) {
			for (const id of added.concat(updated)) {
				controlled.add(id);
			}
			for (const id of removed) {
				controlled.delete(id);
			}
		}
		const enc = encoding.createEncoder();
		encoding.writeVarUint(enc, MESSAGE_AWARENESS);
		encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
		broadcast(room, encoding.toUint8Array(enc));
	});

	rooms.set(name, room);
	return room;
}

function isAuthorized(url) {
	if (AUTH_TOKENS.size === 0) {
		return true;
	}
	// Swap this allowlist check for a JWT verify / session lookup in production.
	return AUTH_TOKENS.has(url.searchParams.get('token') ?? '');
}

const server = Bun.serve({
	port: PORT,
	fetch(req, srv) {
		const url = new URL(req.url);
		const roomName = decodeURIComponent(url.pathname.replace(/^\//u, ''));
		if (!ROOM_NAME_RE.test(roomName)) {
			return new Response('invalid room name', { status: 400 });
		}
		if (!isAuthorized(url)) {
			return new Response('unauthorized', { status: 401 });
		}
		if (srv.upgrade(req, { data: { roomName } })) {
			return undefined;
		}
		return new Response('pptx-viewer collab relay: connect via websocket', { status: 426 });
	},
	websocket: {
		open(ws) {
			const room = getRoom(ws.data.roomName);
			room.conns.set(ws, new Set());
			// Step 1 of the sync handshake + current awareness states.
			const enc = encoding.createEncoder();
			encoding.writeVarUint(enc, MESSAGE_SYNC);
			syncProtocol.writeSyncStep1(enc, room.doc);
			ws.send(encoding.toUint8Array(enc));
			const states = room.awareness.getStates();
			if (states.size > 0) {
				const awarenessEnc = encoding.createEncoder();
				encoding.writeVarUint(awarenessEnc, MESSAGE_AWARENESS);
				encoding.writeVarUint8Array(
					awarenessEnc,
					awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()]),
				);
				ws.send(encoding.toUint8Array(awarenessEnc));
			}
		},
		message(ws, data) {
			const room = rooms.get(ws.data.roomName);
			if (!room || typeof data === 'string') {
				return;
			}
			const decoder = decoding.createDecoder(new Uint8Array(data));
			switch (decoding.readVarUint(decoder)) {
				case MESSAGE_SYNC: {
					const enc = encoding.createEncoder();
					encoding.writeVarUint(enc, MESSAGE_SYNC);
					syncProtocol.readSyncMessage(decoder, enc, room.doc, ws);
					if (encoding.length(enc) > 1) {
						ws.send(encoding.toUint8Array(enc));
					}
					break;
				}
				case MESSAGE_AWARENESS: {
					awarenessProtocol.applyAwarenessUpdate(
						room.awareness,
						decoding.readVarUint8Array(decoder),
						ws,
					);
					break;
				}
				default:
					break;
			}
		},
		close(ws) {
			const room = rooms.get(ws.data.roomName);
			if (!room) {
				return;
			}
			const controlled = room.conns.get(ws) ?? new Set();
			room.conns.delete(ws);
			awarenessProtocol.removeAwarenessStates(room.awareness, [...controlled], null);
			if (room.conns.size === 0) {
				saveRoom(room);
				room.awareness.destroy();
				room.doc.destroy();
				rooms.delete(room.name);
				console.log(`[collab] room "${room.name}" closed`);
			}
		},
	},
});

// Keepalive: browsers answer pings automatically, so idle sessions stay open.
setInterval(() => {
	for (const room of rooms.values()) {
		for (const conn of room.conns.keys()) {
			conn.ping();
		}
	}
}, PING_INTERVAL_MS);

console.log(
	`[collab] listening on ws://localhost:${server.port} ` +
		`(auth: ${AUTH_TOKENS.size > 0 ? `${AUTH_TOKENS.size} token(s)` : 'DISABLED'}, ` +
		`persistence: ${PERSIST ? DATA_DIR : 'DISABLED'})`,
);
