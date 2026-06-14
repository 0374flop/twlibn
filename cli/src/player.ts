import * as readline from "readline";
import { ChunkType, ParsedDemo } from "@twlibn/demo";
import { parseDemoMessage } from "@twlibn/message";
import { Snapshot } from "@twlibn/snapshot";
import { MapParser } from "@twlibn/map";
import { MapRenderer, PlayerPos, attachCameraControls } from "./render";

interface Frame {
	tick: number;
	players: PlayerPos[];
	chat: string[];
	localCid: number | null;
}

function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function buildFrames(demo: ParsedDemo): { frames: Frame[]; initialLocalCid: number | null } {
	const snap = new Snapshot();
	const names = new Map<number, string>();
	const frames: Frame[] = [];
	let initialLocalCid: number | null = null;
	let cur_tick = 0;
	let deltatick = -1;
	let pendingChat: string[] = [];

	const updateNames = () => {
		for (const item of snap.deltas) {
			if (item.type_id === 11) {
				names.set(item.id, (item.parsed as { name: string }).name);
			}
		}
	};

	for (const chunk of demo.chunks) {
		if (chunk.kind === "tick") {
			cur_tick = chunk.tick;
			continue;
		}
		if (chunk.kind !== "chunk") continue;

		if (chunk.type === ChunkType.Snapshot) {
			snap.unpackFullSnapshot(chunk.data, cur_tick);
			deltatick = cur_tick;
			updateNames();
		} else if (chunk.type === ChunkType.SnapshotDelta) {
			snap.unpackSnapshot(chunk.data, deltatick, cur_tick);
			deltatick = cur_tick;
			updateNames();

			let frameCid: number | null = null;
			const players: PlayerPos[] = [];
			for (const item of snap.deltas) {
				if (item.type_id === 10 && (item.parsed as { local: number; client_id: number }).local === 1) {
					frameCid = (item.parsed as { client_id: number }).client_id;
				}
				if (item.type_id === 9) {
					const c = (item.parsed as { character_core: { x: number; y: number; angle: number }; client_id: number }).character_core;
					const cid = (item.parsed as { client_id: number }).client_id;
					players.push({ x: c.x, y: c.y, angle: c.angle, name: names.get(cid) ?? `#${cid}`, cid });
				}
			}
			if (initialLocalCid === null && frameCid !== null) initialLocalCid = frameCid;

			frames.push({ tick: cur_tick, players, chat: pendingChat, localCid: frameCid });
			pendingChat = [];
		} else if (chunk.type === ChunkType.Message) {
			try {
				const msg = parseDemoMessage(chunk.data);
				if (msg.kind !== "SvChat") continue;
				if (msg.client_id === -1) {
					pendingChat.push(`*** ${msg.message}`);
				} else {
					const name = names.get(msg.client_id) ?? `#${msg.client_id}`;
					const team = msg.team === 0 ? "" : msg.team;
					pendingChat.push(`${msg.client_id}:${team} ${name} : ${msg.message}`);
				}
			} catch (e) {
				// skip
			}
		}
	}

	return { frames, initialLocalCid };
}

export function playDemo(demo: ParsedDemo): void {
	const map = MapParser.parse(demo.map_data);
	if (!map.game_layer || !map.game_layer.tiles) {
		console.error("no game layer in demo");
		return;
	}

	const tiles = map.game_layer.tiles.map(row => row.map((t: { id: number }) => t.id));
	const front = map.front_layer?.tiles?.map(row => row.map((t: { id: number }) => t.id));
	const renderer = new MapRenderer(tiles, front);

	const { frames, initialLocalCid } = buildFrames(demo);
	if (frames.length === 0) {
		console.error("no frames in demo");
		return;
	}

	const totalTicks = frames[frames.length - 1].tick - frames[0].tick;
	const totalSeconds = totalTicks / 50;
	let frameIdx = 0;
	let lastChatFrameIdx = -1;
	let paused = false;
	let manualFollow = false;

	if (initialLocalCid !== null) renderer.follow(initialLocalCid);

	const getPlayerList = (): PlayerPos[] => frames[frameIdx]?.players ?? [];

	const updateOverlay = () => {
		const tick = frames[frameIdx]?.tick ?? frames[0].tick;
		const elapsed = (tick - frames[0].tick) / 50;
		const followed = renderer.getFollowCid();
		const followedName = followed !== null
			? (getPlayerList().find(p => p.cid === followed)?.name ?? `#${followed}`)
			: "free";
		const pauseStr = paused ? " [PAUSED]" : "";
		renderer.setOverlay([
			`  ${formatTime(elapsed)} / ${formatTime(totalSeconds)}${pauseStr}  following: ${followedName}`,
		]);
	};

	const renderFrame = () => {
		const frame = frames[frameIdx];
		if (!frame) return;
		if (frameIdx !== lastChatFrameIdx) {
			for (const line of frame.chat) renderer.pushChat(line);
			lastChatFrameIdx = frameIdx;
		}
		if (!manualFollow && frame.localCid !== null) renderer.follow(frame.localCid);
		renderer.setPlayers(frame.players);
		updateOverlay();
		renderer.render();
	};

	const TICK_MS = 1000 / 50;
	let playbackTick = frames[0].tick;
	let lastRealTime = Date.now();

	const getFrameForTick = (tick: number): number => {
		let lo = 0, hi = frames.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (frames[mid].tick <= tick) lo = mid;
			else hi = mid - 1;
		}
		return lo;
	};

	const interval = setInterval(() => {
		if (paused) return;
		const now = Date.now();
		const elapsedMs = now - lastRealTime;
		lastRealTime = now;
		playbackTick += elapsedMs / TICK_MS;
		const maxTick = frames[frames.length - 1].tick;
		if (playbackTick >= maxTick) playbackTick = maxTick;
		frameIdx = getFrameForTick(Math.floor(playbackTick));
		renderFrame();
	}, 16);

	const switchPlayer = (dir: 1 | -1) => {
		manualFollow = true;
		const players = getPlayerList();
		if (players.length === 0) return;
		const followed = renderer.getFollowCid();
		const idx = followed !== null ? players.findIndex(p => p.cid === followed) : -1;
		const next = (idx + dir + players.length) % players.length;
		renderer.follow(players[next].cid);
		updateOverlay();
		renderer.render();
	};

	let seekHeldSince: number | null = null;

	const seek = (dir: 1 | -1, held: boolean) => {
		const baseSecs = 5;
		const maxSecs = 60;
		let secs = baseSecs;
		if (held && seekHeldSince !== null) {
			const heldMs = Date.now() - seekHeldSince;
			secs = Math.min(baseSecs + Math.floor(heldMs / 500) * 5, maxSecs);
		}
		const minTick = frames[0].tick;
		const maxTick = frames[frames.length - 1].tick;
		playbackTick = Math.max(minTick, Math.min(playbackTick + dir * secs * 50, maxTick));
		frameIdx = getFrameForTick(Math.floor(playbackTick));
		lastRealTime = Date.now();
		renderFrame();
	};

	const keyHeld: Record<string, NodeJS.Timeout | null> = { z: null, c: null };

	readline.emitKeypressEvents(process.stdin);
	if (process.stdin.isTTY) process.stdin.setRawMode(true);

	process.stdin.on("keypress", (_str, key) => {
		if (!key) return;

		if (key.name === " " || key.name === "x") {
			paused = !paused;
			if (!paused) lastRealTime = Date.now();
			updateOverlay();
			renderer.render();
			return;
		}

		if (key.name === "q") { switchPlayer(-1); return; }
		if (key.name === "e") { switchPlayer(1); return; }

		if (key.name === "z") {
			if (!keyHeld.z) {
				seekHeldSince = Date.now();
				seek(-1, false);
				keyHeld.z = setInterval(() => seek(-1, true), 100);
				const stop = () => { if (keyHeld.z) { clearInterval(keyHeld.z); keyHeld.z = null; seekHeldSince = null; } };
				setTimeout(stop, 600);
			} else {
				seek(-1, true);
			}
			return;
		}
		if (key.name === "c") {
			if (!keyHeld.c) {
				seekHeldSince = Date.now();
				seek(1, false);
				keyHeld.c = setInterval(() => seek(1, true), 100);
				const stop = () => { if (keyHeld.c) { clearInterval(keyHeld.c); keyHeld.c = null; seekHeldSince = null; } };
				setTimeout(stop, 600);
			} else {
				seek(1, true);
			}
			return;
		}
	});

	process.stdin.on("keypress", (_str, key) => {
		if (!key) return;
		if (key.name === "z" && keyHeld.z) { clearInterval(keyHeld.z); keyHeld.z = null; seekHeldSince = null; }
		if (key.name === "c" && keyHeld.c) { clearInterval(keyHeld.c); keyHeld.c = null; seekHeldSince = null; }
	});

	attachCameraControls(renderer, () => {
		clearInterval(interval);
		for (const k of Object.values(keyHeld)) if (k) clearInterval(k);
		renderer.destroy();
		process.exit(0);
	});

	renderFrame();
}
