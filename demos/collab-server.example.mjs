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
 *    token fails validation. Two modes:
 *      JWT mode (production): set COLLAB_AUTH_JWT_SECRET and mint short-lived
 *      HS256 tokens from your app server. Verified claims: `exp` (required),
 *      `room` (optional: token only opens that room), `role` (optional:
 *      'viewer' makes the connection READ-ONLY - the relay drops its document
 *      writes, so client-side canEdit is enforced, not just advisory), `sub`
 *      (user id, logged). Minting is one HMAC call, see mintCollabToken below.
 *      Allowlist mode (dev): set COLLAB_AUTH_TOKENS=a,b,c instead.
 *  - PERSISTENCE: each room's Y.Doc is loaded from disk on first join and
 *    snapshotted (debounced, plus on last disconnect) so documents survive
 *    server restarts.
 *
 * Zero npm installs inside this repo: it runs on Bun's built-in websocket
 * server and the yjs / y-protocols / lib0 packages already present.
 *
 * Run (from the repo root):
 *   COLLAB_AUTH_JWT_SECRET=change-me bun demos/collab-server.example.mjs
 *
 * Environment:
 *   PORT                    websocket port (default 1234)
 *   COLLAB_AUTH_JWT_SECRET  HS256 secret; enables JWT mode (takes precedence)
 *   COLLAB_AUTH_TOKENS      comma-separated static tokens (allowlist mode).
 *                           BOTH unset = auth DISABLED (local dev only).
 *   COLLAB_DATA_DIR         snapshot directory (default ./collab-data).
 *                           Set to '-' to disable persistence.
 *
 * Then point every viewer client at:
 *   serverUrl: 'ws://localhost:1234'
 *   roomId:    '<document-id>'
 *   authToken: '<jwt-or-static-token>'
 *
 * Mint tokens in your app server (Node/Bun, no library needed):
 *
 *   import { createHmac } from 'node:crypto';
 *   const b64u = (s) => Buffer.from(s).toString('base64url');
 *   function mintCollabToken(secret, { sub, room, role, ttlSeconds = 900 }) {
 *     const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
 *     const payload = b64u(JSON.stringify({
 *       sub, room, role, exp: Math.floor(Date.now() / 1000) + ttlSeconds,
 *     }));
 *     const sig = createHmac('sha256', secret)
 *       .update(`${header}.${payload}`).digest('base64url');
 *     return `${header}.${payload}.${sig}`;
 *   }
 *
 * Production notes: terminate TLS in front of this (wss://) and keep the
 * data dir on durable storage. Tokens travel in the URL query, so keep TTLs
 * short and avoid logging request URLs upstream.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const PORT = Number(process.env.PORT ?? 1234);
const JWT_SECRET = process.env.COLLAB_AUTH_JWT_SECRET ?? '';
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

const b64urlToBuffer = (s) => Buffer.from(s, 'base64url');

/**
 * Verify an HS256 JWT: signature (constant-time), then `exp`. Returns the
 * payload claims, or null when invalid.
 */
function verifyJwtHS256(token, secret) {
	const parts = token.split('.');
	if (parts.length !== 3) {
		return null;
	}
	try {
		const [head, body, sig] = parts;
		const header = JSON.parse(b64urlToBuffer(head).toString());
		if (header.alg !== 'HS256') {
			return null;
		}
		const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest();
		const actual = b64urlToBuffer(sig);
		if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
			return null;
		}
		const claims = JSON.parse(b64urlToBuffer(body).toString());
		if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
			return null;
		}
		return claims;
	} catch {
		return null;
	}
}

/**
 * Authenticate a handshake. Returns a session ({ userId, readOnly }) or null
 * to reject with 401.
 */
function authorize(url, roomName) {
	const token = url.searchParams.get('token') ?? '';
	if (JWT_SECRET) {
		const claims = verifyJwtHS256(token, JWT_SECRET);
		if (!claims) {
			return null;
		}
		if (typeof claims.room === 'string' && claims.room !== roomName) {
			return null;
		}
		return {
			userId: typeof claims.sub === 'string' ? claims.sub : 'unknown',
			readOnly: claims.role === 'viewer',
		};
	}
	if (AUTH_TOKENS.size > 0) {
		return AUTH_TOKENS.has(token) ? { userId: 'shared-token-user', readOnly: false } : null;
	}
	return { userId: 'anonymous', readOnly: false };
}

const server = Bun.serve({
	port: PORT,
	fetch(req, srv) {
		const url = new URL(req.url);
		const roomName = decodeURIComponent(url.pathname.replace(/^\//u, ''));
		if (!ROOM_NAME_RE.test(roomName)) {
			return new Response('invalid room name', { status: 400 });
		}
		const session = authorize(url, roomName);
		if (!session) {
			return new Response('unauthorized', { status: 401 });
		}
		if (srv.upgrade(req, { data: { roomName, session } })) {
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
					const syncType = decoding.readVarUint(decoder);
					// Read-only sessions may still request state (step 1), but their
					// document writes (step 2 / update) are dropped at the relay:
					// `role: 'viewer'` is enforced here, not just in the client UI.
					if (ws.data.session.readOnly && syncType !== syncProtocol.messageYjsSyncStep1) {
						break;
					}
					switch (syncType) {
						case syncProtocol.messageYjsSyncStep1:
							syncProtocol.readSyncStep1(decoder, enc, room.doc);
							break;
						case syncProtocol.messageYjsSyncStep2:
							syncProtocol.readSyncStep2(decoder, room.doc, ws);
							break;
						case syncProtocol.messageYjsUpdate:
							syncProtocol.readUpdate(decoder, room.doc, ws);
							break;
						default:
							break;
					}
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

const authMode = JWT_SECRET
	? 'jwt'
	: AUTH_TOKENS.size > 0
		? `allowlist (${AUTH_TOKENS.size} token(s))`
		: 'DISABLED';
console.log(
	`[collab] listening on ws://localhost:${server.port} ` +
		`(auth: ${authMode}, persistence: ${PERSIST ? DATA_DIR : 'DISABLED'})`,
);
