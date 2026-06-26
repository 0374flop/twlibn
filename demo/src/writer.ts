import { Huffman } from "@twlibn/core";
import { DemoHeader, TimelineMarkers, DemoChunk, ChunkType } from "./demo";

const huff = new Huffman();

function writeCString(buf: Buffer, offset: number, str: string, maxLen: number): void {
	const encoded = Buffer.from(str, "utf8");
	const len = Math.min(encoded.length, maxLen - 1);
	encoded.copy(buf, offset, 0, len);
	buf.fill(0, offset + len, offset + maxLen);
}

function writeHeader(header: DemoHeader): Buffer {
	const buf = Buffer.alloc(7 + 1 + 64 + 64 + 4 + 4 + 8 + 4 + 20);
	let off = 0;

	buf.write("TWDEMO\0", off, "ascii"); off += 7;
	buf.writeUInt8(header.version, off); off += 1;
	writeCString(buf, off, header.net_version, 64); off += 64;
	writeCString(buf, off, header.map_name, 64); off += 64;
	buf.writeInt32BE(header.map_size, off); off += 4;
	buf.writeInt32BE(header.map_crc, off); off += 4;
	writeCString(buf, off, header.type, 8); off += 8;
	buf.writeInt32BE(header.length, off); off += 4;
	writeCString(buf, off, header.timestamp, 20); off += 20;

	return buf;
}

function writeTimeline(timeline: TimelineMarkers): Buffer {
	const buf = Buffer.alloc(4 + 64 * 4);
	buf.writeInt32BE(timeline.count, 0);
	for (let i = 0; i < 64; i++) {
		buf.writeInt32BE(timeline.markers[i] ?? 0, 4 + i * 4);
	}
	return buf;
}

function writeTickChunkV5(tick: number, prev_tick: number, keyframe: boolean): Buffer {
	const delta = tick - prev_tick;
	if (delta > 0 && delta < 0x20) {
		const first = 0x80 | (keyframe ? 0x40 : 0) | 0x20 | (delta & 0x1f);
		return Buffer.from([first]);
	}
	const first = 0x80 | (keyframe ? 0x40 : 0);
	const buf = Buffer.alloc(5);
	buf.writeUInt8(first, 0);
	buf.writeInt32BE(tick, 1);
	return buf;
}

function writeDataChunk(type: ChunkType, data: Buffer): Buffer {
	const compressed = huff.compress(data);
	const size = compressed.length;

	let header: Buffer;
	if (size < 30) {
		header = Buffer.from([(type << 5) | size]);
	} else if (size < 256) {
		header = Buffer.from([(type << 5) | 30, size]);
	} else {
		header = Buffer.alloc(3);
		header.writeUInt8((type << 5) | 31, 0);
		header.writeUInt16LE(size, 1);
	}

	return Buffer.concat([header, compressed]);
}

export interface DemoWriterOptions {
	net_version?: string;
	map_name?: string;
	map_crc?: number;
	map_data: Buffer;
	type?: "client" | "server";
	timestamp?: string;
}

export class DemoWriter {
	private chunks: Buffer[] = [];
	private prev_tick = 0;
	private tick_count = 0;
	private header: DemoHeader;
	private map_data: Buffer;

	constructor(opts: DemoWriterOptions) {
		this.map_data = opts.map_data;
		this.header = {
			magic: "TWDEMO",
			version: 6,
			net_version: opts.net_version ?? "0.6 626fce9a778df4d4",
			map_name: opts.map_name ?? "",
			map_size: opts.map_data.length,
			map_crc: opts.map_crc ?? 0,
			type: opts.type ?? "client",
			length: 0,
			timestamp: opts.timestamp ?? new Date().toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19),
		};
	}

	tick(tick: number, keyframe = false): this {
		this.chunks.push(writeTickChunkV5(tick, this.prev_tick, keyframe));
		this.prev_tick = tick;
		this.tick_count++;
		return this;
	}

	snapshot(data: Buffer): this {
		this.chunks.push(writeDataChunk(ChunkType.Snapshot, data));
		return this;
	}

	snapshotDelta(data: Buffer): this {
		this.chunks.push(writeDataChunk(ChunkType.SnapshotDelta, data));
		return this;
	}

	message(data: Buffer): this {
		this.chunks.push(writeDataChunk(ChunkType.Message, data));
		return this;
	}

	build(): Buffer {
		const chunksBuf = Buffer.concat(this.chunks);

		this.header.length = Math.floor(this.prev_tick / 50);
		this.header.map_size = this.map_data.length;

		const headerBuf = writeHeader(this.header);

		const SHA256_EXT_UUID = Buffer.from("6be6da4acebd380c9b5b1289c842d780", "hex");
		const sha256 = Buffer.concat([SHA256_EXT_UUID, Buffer.alloc(32)]);

		const timeline = writeTimeline({ count: 0, markers: [] });

		return Buffer.concat([headerBuf, timeline, sha256, this.map_data, chunksBuf]);
	}
}
