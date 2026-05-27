export interface DemoHeader {
	magic: string;
	version: number;
	net_version: string;
	map_name: string;
	map_size: number;
	map_crc: number;
	type: "client" | "server" | string;
	length: number;
	timestamp: string;
}

export interface TimelineMarkers {
	count: number;
	markers: number[];
}

export const enum ChunkType {
	Invalid = 0,
	Snapshot = 1,
	Message = 2,
	SnapshotDelta = 3,
}

export interface TickChunk {
	kind: "tick";
	keyframe: boolean;
	tick: number;
	delta: boolean;
}

export interface DataChunk {
	kind: "chunk";
	type: ChunkType;
	data: Buffer;
}

export type DemoChunk = TickChunk | DataChunk;

export interface ParsedDemo {
	header: DemoHeader;
	timeline?: TimelineMarkers;
	map_data: Buffer;
	chunks: DemoChunk[];
}