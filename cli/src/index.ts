#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { DemoParser, ChunkType } from "@twlibn/demo";
import { parseDemoMessage } from "@twlibn/message";
import { Snapshot } from "@twlibn/snapshot";
import { MapParser } from "@twlibn/map";
import { Renderer } from "./renderer/index";
import { MapLayer } from "./renderer/game";
import { StatusLayer } from "./renderer/ui";
import { playDemo } from "./player";
import { liveView } from "./live";

const program = new Command();

program
	.name("twlibn")
	.description("DDNet/Teeworlds toolkit")
	.version("0.0.1");

const demoCmd = program.command("demo [file]").description("inspect a demo file")
	.option("-m, --messages", "show all network messages")
	.option("-c, --chat [filter]", "show chat (pl = players only, sys = system only)")
	.option("-T, --time", "show timestamp before each chat message")
	.option("-o, --output <file>", "export chat to file")
	.option("-p, --players", "show all player identities as JSON")
	.option("-s, --snapshots", "show snapshot counts per tick")
	.option("-t, --tick <n>", "dump snapshot at tick N", parseInt)
	.action((file: string | undefined, opts: { messages?: boolean; chat?: string | boolean; time?: boolean; output?: string; players?: boolean; snapshots?: boolean; tick?: number }) => {
		if (!file) { console.error("error: missing file argument"); process.exit(1); }
		const buf = fs.readFileSync(path.resolve(file));
		const t0 = performance.now();
		const demo = DemoParser.parse(buf);
		const t1 = performance.now();
		const h = demo.header;

		console.log("=== header ===");
		console.log(`version:     ${h.version}`);
		console.log(`net_version: ${h.net_version}`);
		console.log(`map:         ${h.map_name} (crc=${h.map_crc}, size=${h.map_size})`);
		console.log(`type:        ${h.type}`);
		console.log(`length:      ${h.length}`);
		console.log(`parsed in:   ${(t1 - t0).toFixed(2)}ms`);
		console.log(`recorded:    ${h.timestamp}`);
		const dur = h.length;
		const mm = Math.floor(dur / 60);
		const ss = dur % 60;
		console.log(`duration:    ${mm}m ${ss}s`);

		if (demo.timeline) {
			console.log(`markers:     ${demo.timeline.count}`);
		}

		const ticks = demo.chunks.filter(c => c.kind === "tick").length;
		const snaps = demo.chunks.filter(c => c.kind === "chunk" && c.type === ChunkType.Snapshot).length;
		const deltas = demo.chunks.filter(c => c.kind === "chunk" && c.type === ChunkType.SnapshotDelta).length;
		const msgs = demo.chunks.filter(c => c.kind === "chunk" && c.type === ChunkType.Message).length;

		console.log("\n=== chunks ===");
		console.log(`ticks:           ${ticks}`);
		console.log(`snapshots:       ${snaps}`);
		console.log(`snapshot deltas: ${deltas}`);
		console.log(`messages:        ${msgs}`);

		const noFlags = !opts.messages && !opts.chat && !opts.players && !opts.snapshots && opts.tick === undefined;
		if (noFlags) console.log("\ntip: use -c to show chat");

		if (opts.messages || opts.chat) {
			const chatFilter = typeof opts.chat === "string" ? opts.chat : null;
			const snap = new Snapshot();
			const names = new Map<number, string>();
			let cur_tick = 0;
			let first_tick: number | null = null;
			let deltatick = -1;
			const lines: string[] = [];
			const tParse0 = performance.now();

			const baseTime = new Date(h.timestamp.replace("_", "T").replace(/-(\d{2})-(\d{2})$/, ":$1:$2"));
			const formatTick = (tick: number): string => {
				const ms = ((tick - (first_tick ?? tick)) / 50) * 1000;
				const d = new Date(baseTime.getTime() + ms);
				return `[${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}]`;
			};

			for (const chunk of demo.chunks) {
				if (chunk.kind === "tick") {
					cur_tick = chunk.tick;
					if (first_tick === null) first_tick = cur_tick;
					continue;
				}
				if (chunk.kind !== "chunk") continue;

				if (chunk.type === ChunkType.Snapshot) {
					const { items } = snap.unpackFullSnapshot(chunk.data, cur_tick);
					deltatick = cur_tick;
					for (const item of items)
						if (item.type_id === 11) names.set(item.id, (item.parsed as { name: string }).name);
				} else if (chunk.type === ChunkType.SnapshotDelta) {
					const { items } = snap.unpackSnapshot(chunk.data, deltatick, cur_tick);
					deltatick = cur_tick;
					for (const item of items)
						if (item.type_id === 11) names.set(item.id, (item.parsed as { name: string }).name);
				} else if (chunk.type === ChunkType.Message) {
					try {
						const msg = parseDemoMessage(chunk.data);
						if (msg.kind === "Unknown") continue;
						if (opts.chat && msg.kind !== "SvChat") continue;
						if (opts.chat && msg.kind === "SvChat") {
							const isSystem = msg.client_id === -1;
							if (chatFilter === "sys" && !isSystem) continue;
							if (chatFilter === "pl" && isSystem) continue;
							const prefix = opts.time ? formatTick(cur_tick) + " " : "";
							if (isSystem) {
								lines.push(`${prefix}*** ${msg.message}`);
							} else {
								const name = names.get(msg.client_id) ?? `#${msg.client_id}`;
								const team = msg.team === 0 ? "" : msg.team;
								lines.push(`${prefix}${msg.client_id}:${team} ${name} : ${msg.message}`);
							}
							continue;
						}
						lines.push(JSON.stringify(msg));
					} catch (e) {
						lines.push(`[parse error] ${e}`);
					}
				}
			}
			const tParse1 = performance.now();
			const label = opts.chat ? (chatFilter === "sys" ? "=== chat (system) ===" : chatFilter === "pl" ? "=== chat (players) ===" : "=== chat ===") : "=== messages ===";
			console.log("\n" + label);
			const tOut0 = performance.now();
			if (opts.output) {
				fs.writeFileSync(path.resolve(opts.output), lines.join("\n") + "\n");
				console.log(`saved to: ${opts.output}`);
			} else {
				process.stdout.write(lines.join("\n") + "\n");
			}
			const tOut1 = performance.now();
			console.log(`\nparsed in:   ${(tParse1 - tParse0).toFixed(2)}ms`);
			console.log(`output in:   ${(tOut1 - tOut0).toFixed(2)}ms`);
		}

		if (opts.players) {
			const snap = new Snapshot();
			let cur_tick = 0;
			let deltatick = -1;
			const players = new Map<number, object>();

			for (const chunk of demo.chunks) {
				if (chunk.kind === "tick") { cur_tick = chunk.tick; continue; }
				if (chunk.kind !== "chunk") continue;
				let items: { type_id: number; id: number; parsed: unknown }[] = [];
				if (chunk.type === ChunkType.Snapshot) {
					({ items } = snap.unpackFullSnapshot(chunk.data, cur_tick)); deltatick = cur_tick;
				} else if (chunk.type === ChunkType.SnapshotDelta) {
					({ items } = snap.unpackSnapshot(chunk.data, deltatick, cur_tick)); deltatick = cur_tick;
				}
				for (const item of items)
					if (item.type_id === 11) players.set(item.id, item.parsed as object);
			}
			process.stdout.write(JSON.stringify([...players.values()], null, 4) + "\n");
		}

		if (opts.snapshots || opts.tick !== undefined) {
			console.log("\n=== snapshots ===");
			const snap = new Snapshot();
			let cur_tick = 0;
			let deltatick = -1;

			for (const chunk of demo.chunks) {
				if (chunk.kind === "tick") {
					cur_tick = chunk.tick;
					continue;
				}
				if (chunk.kind !== "chunk") continue;

				if (chunk.type === ChunkType.Snapshot) {
					const { items } = snap.unpackFullSnapshot(chunk.data, cur_tick);
					deltatick = cur_tick;

					if (opts.tick !== undefined && cur_tick === opts.tick) {
						console.log(`tick ${cur_tick} (full):`);
						for (const item of items) {
							console.log(`  type=${item.type_id} id=${item.id}`, JSON.stringify(item.parsed));
						}
					} else if (opts.snapshots) {
						console.log(`tick ${cur_tick} (full): ${items.length} items`);
					}
				} else if (chunk.type === ChunkType.SnapshotDelta) {
					const result = snap.unpackSnapshot(chunk.data, deltatick, cur_tick);
					deltatick = cur_tick;

					if (opts.tick !== undefined && cur_tick === opts.tick) {
						console.log(`tick ${cur_tick} (delta):`);
						for (const item of result.items) {
							console.log(`  type=${item.type_id} id=${item.id}`, JSON.stringify(item.parsed));
						}
					} else if (opts.snapshots) {
						console.log(`tick ${cur_tick} (delta): ${result.items.length} items`);
					}
				}
			}
		}
	});

demoCmd
	.command("play <file>")
	.aliases(["player"])
	.description("replay demo in real time")
	.action((file: string) => {
		const buf = fs.readFileSync(path.resolve(file));
		const demo = DemoParser.parse(buf);
		playDemo(demo);
	});

const mapCmd = program.command("map [file]").description("inspect a map file")
	.action((file: string | undefined) => {
		if (!file) { console.error("error: missing file argument"); process.exit(1); }
		const buf = fs.readFileSync(path.resolve(file));
		const map = MapParser.parse(buf);

		console.log("=== map ===");
		console.log(`datafile version: ${map.datafile_version}`);
		if (map.info) {
			const i = map.info;
			if (i.author)  console.log(`author:  ${i.author}`);
			if (i.version) console.log(`version: ${i.version}`);
			if (i.credits) console.log(`credits: ${i.credits}`);
			if (i.license) console.log(`license: ${i.license}`);
			if (i.settings.length) console.log(`settings (${i.settings.length}):`);
			for (const s of i.settings) console.log(`  ${s}`);
		}
		console.log(`groups:    ${map.groups.length}`);
		console.log(`images:    ${map.images.length}`);
		console.log(`sounds:    ${map.sounds.length}`);
		console.log(`envelopes: ${map.envelopes.length}`);

		if (map.game_layer) {
			const g = map.game_layer;
			console.log(`size:      ${g.width}x${g.height}`);
		}
	});

mapCmd
	.command("info <file>")
	.description("show groups, images and envelopes")
	.option("-g, --groups", "show groups and layers")
	.option("-i, --images", "show images")
	.option("-e, --envelopes", "show envelopes")
	.action((file: string, opts: { groups?: boolean; images?: boolean; envelopes?: boolean }) => {
		const buf = fs.readFileSync(path.resolve(file));
		const map = MapParser.parse(buf);

		if (opts.groups) {
			console.log("\n=== groups ===");
			for (const g of map.groups) {
				console.log(`  [${g.name || "(unnamed)"}] layers=${g.layers.length} offset=(${g.x_offset},${g.y_offset}) parallax=(${g.x_parallax},${g.y_parallax})`);
				for (const l of g.layers) {
					if ("layer_type" in l) {
						console.log(`    tile  [${l.name || "(unnamed)"}] ${l.width}x${l.height} type=${l.layer_type}`);
					} else if ("quads" in l) {
						console.log(`    quad  [${l.name || "(unnamed)"}] quads=${l.quads.length}`);
					} else if ("sources" in l) {
						console.log(`    sound [${l.name || "(unnamed)"}] sources=${l.sources.length}`);
					}
				}
			}
		}

		if (opts.images) {
			console.log("\n=== images ===");
			for (let i = 0; i < map.images.length; i++) {
				const img = map.images[i];
				console.log(`  [${i}] ${img.name} ${img.width}x${img.height}${img.external ? " (external)" : ""}`);
			}
		}

		if (opts.envelopes) {
			console.log("\n=== envelopes ===");
			for (let i = 0; i < map.envelopes.length; i++) {
				const e = map.envelopes[i];
				console.log(`  [${i}] ${e.name || "(unnamed)"} channels=${e.channels} points=${e.points.length}`);
			}
		}
	});

mapCmd
	.command("view <file>")
	.description("open interactive map viewer")
	.action((file: string) => {
		const buf = fs.readFileSync(path.resolve(file));
		const map = MapParser.parse(buf);
		if (!map.game_layer || !map.game_layer.tiles) {
			console.error("no game layer to render");
			return;
		}
		const tiles = map.game_layer.tiles.map(row => row.map((t: { id: number }) => t.id));
		const front = map.front_layer?.tiles?.map(row => row.map((t: { id: number }) => t.id));
		const renderer = new Renderer();
		const mapLayer = new MapLayer();
		const statusLayer = new StatusLayer();
		mapLayer.setTiles(tiles, front);
		statusLayer.setText("[WASD] move  [T] quit");
		renderer.add(mapLayer);
		renderer.add(statusLayer);
		renderer.render();

		const readline2 = require("readline");
		readline2.emitKeypressEvents(process.stdin);
		if (process.stdin.isTTY) process.stdin.setRawMode(true);
		process.stdin.on("keypress", (_str: unknown, key: { name?: string; ctrl?: boolean }) => {
			if (!key) return;
			if (key.name === "t" || (key.ctrl && key.name === "c")) { renderer.destroy(); process.exit(0); }
			const moves: Record<string, [number, number]> = {
				up: [0, -4], down: [0, 4], left: [-4, 0], right: [4, 0],
				w: [0, -4], s: [0, 4], a: [-4, 0], d: [4, 0],
			};
			const mv = moves[key.name ?? ""];
			if (mv) { renderer.moveCamera(mv[0], mv[1]); renderer.render(); }
		});
		process.on("SIGINT", () => { renderer.destroy(); process.exit(0); });
	});

program
	.command("client <address> [name]")
	.description("connect to a DDNet/Teeworlds server")
	.action((address: string, name: string = "twlibn") => {
		const [host, portStr] = address.split(":");
		const port = parseInt(portStr ?? "8303");
		if (!host || isNaN(port)) { console.error("error: invalid address, expected ip:port"); process.exit(1); }
		liveView(host, port, name);
	});

program.parse(process.argv);
