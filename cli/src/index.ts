#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { DemoParser, ChunkType } from "@twlibn/demo";
import { parseDemoMessage } from "@twlibn/message";
import { Snapshot } from "@twlibn/snapshot";
import { MapParser } from "@twlibn/map";
import { startInteractive, MapRenderer, PlayerPos, attachCameraControls } from "./pender";

const program = new Command();

program
	.name("twlibn")
	.description("twlibn cli")
	.version("0.0.1");

program
	.command("demo <file>")
	.description("parse demo file")
	.option("-m, --messages", "print parsed messages")
	.option("-c, --chat", "print chat messages only")
	.option("-l, --live", "replay demo in real time")
	.option("-s, --snapshots", "print snapshot item counts per tick")
	.option("-t, --tick <n>", "print snapshot items for specific tick", parseInt)
	.option("-r, --render", "render players on map during --live (uses embedded map)")
	.action((file: string, opts: { messages?: boolean; chat?: boolean; live?: boolean; snapshots?: boolean; tick?: number; render?: boolean }) => {
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

		if (opts.render && !opts.live) console.log("\nnote: -r/--render has no effect without -l/--live");

		const noFlags = !opts.messages && !opts.chat && !opts.live && !opts.snapshots && opts.tick === undefined && !opts.render;
		if (noFlags) opts.chat = true;

		if (opts.messages || opts.chat) {
			const snap = new Snapshot();
			const names = new Map<number, string>();
			let cur_tick = 0;
			let deltatick = -1;
			const lines: string[] = [];
			const tParse0 = performance.now();

			for (const chunk of demo.chunks) {
				if (chunk.kind === "tick") {
					cur_tick = chunk.tick;
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
							if (msg.client_id === -1) {
								lines.push(`*** ${msg.message}`);
							} else {
								const name = names.get(msg.client_id) ?? `#${msg.client_id}`;
								const team = msg.team === 0 ? "" : msg.team;
								lines.push(`${msg.client_id}:${team} ${name} : ${msg.message}`);
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
			if (noFlags) console.log("\n=== chat (no flags given, showing chat only) ===");
			else console.log("\n=== messages ===");
			const tOut0 = performance.now();
			process.stdout.write(lines.join("\n") + "\n");
			const tOut1 = performance.now();
			console.log(`\nparsed in:   ${(tParse1 - tParse0).toFixed(2)}ms`);
			console.log(`output in:   ${(tOut1 - tOut0).toFixed(2)}ms`);
		}

		if (opts.live) {
			if (!opts.render) console.log("note: --live only renders chat for now");
			let renderer: MapRenderer | undefined;
			if (opts.render) {
				const map = MapParser.parse(demo.map_data);
				if (map.game_layer && map.game_layer.tiles) {
					const tiles = map.game_layer.tiles.map(row => row.map(t => t.id));
					const front = map.front_layer?.tiles?.map(row => row.map(t => t.id));
					renderer = new MapRenderer(tiles, front);
					attachCameraControls(renderer);
					renderer.render();
				}
			} else {
				console.log("\n=== live ===");
			}
			const snap = new Snapshot();
			const names = new Map<number, string>();
			let startTick = -1;
			let cur_tick = 0;
			let deltatick = -1;
			const startTime = Date.now();

			const updateNames = () => {
				for (const item of snap.deltas) {
					if (item.type_id === 11) {
						const info = item.parsed as { name: string };
						names.set(item.id, info.name);
					}
				}
			};

			for (const chunk of demo.chunks) {
				if (chunk.kind === "tick") {
					cur_tick = chunk.tick;
					if (startTick === -1) startTick = cur_tick;
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
					if (renderer) {
						const tick = cur_tick;
						const delay = ((tick - startTick) / 50) * 1000 - (Date.now() - startTime);
						const players: PlayerPos[] = [];
						for (const item of snap.deltas) {
							if (item.type_id === 9) {
								const c = (item.parsed as { character_core: { x: number; y: number; angle: number }; client_id: number }).character_core;
								const cid = (item.parsed as { client_id: number }).client_id;
								players.push({ x: c.x, y: c.y, angle: c.angle, name: names.get(cid) ?? `#${cid}` });
							}
						}
						setTimeout(() => {
							renderer!.setPlayers(players);
							renderer!.render();
						}, Math.max(0, delay));
					}
				} else if (chunk.type === ChunkType.Message) {
					try {
						const msg = parseDemoMessage(chunk.data);
						if (msg.kind !== "SvChat") continue;
						const tick = cur_tick;
						const delay = ((tick - startTick) / 50) * 1000 - (Date.now() - startTime);
						const captured = { client_id: msg.client_id, team: msg.team, message: msg.message };
						const capturedNames = new Map(names);
						setTimeout(() => {
							let line: string;
							if (captured.client_id === -1) {
								line = `*** ${captured.message}`;
							} else {
								const name = capturedNames.get(captured.client_id) ?? `#${captured.client_id}`;
								const team = captured.team === 0 ? "" : captured.team;
								line = `${captured.client_id}:${team} ${name} : ${captured.message}`;
							}
							if (renderer) {
								renderer.pushChat(line);
								renderer.render();
							} else {
								console.log(line);
							}
						}, Math.max(0, delay));
					} catch (e) {
						// skip
					}
				}
			}
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

program
	.command("map <file>")
	.description("parse map file")
	.option("-g, --groups", "print groups and layers")
	.option("-i, --images", "print images")
	.option("-e, --envelopes", "print envelopes")
	.option("-r, --render", "interactive render of game layer")
	.action((file: string, opts: { groups?: boolean; images?: boolean; envelopes?: boolean; render?: boolean }) => {
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

		if (opts.render) {
			if (!map.game_layer || !map.game_layer.tiles) {
				console.error("no game layer to render");
				return;
			}
			const tiles = map.game_layer.tiles.map(row => row.map(t => t.id));
			const front = map.front_layer?.tiles?.map(row => row.map(t => t.id));
			startInteractive(tiles, front);
		}
	});

program.parse(process.argv);
