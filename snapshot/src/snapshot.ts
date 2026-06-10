import { MsgUnpacker, UUIDManager, createTwMD5Hash } from "@twlibn/core";
import type { Item, DDNetItem, DeltaItem, ESnap } from "./items";
import { ITEM_SIZES, SUPPORTED_UUIDS, parseItem } from "./items";

function undiffItem(old: number[], delta: number[]): number[] {
	const out = [...delta];
	for (let i = 0; i < old.length; i++) {
		if (out[i] !== undefined) out[i] += old[i];
		else out[i] = 0;
	}
	return out;
}

function arraysEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

export class Snapshot {
	deltas: DeltaItem[] = [];
	private eSnapHolder: { ack: number; Snapshot: ESnap }[] = [];
	private _events: { type_id: number; parsed: Item | DDNetItem }[] = [];

	crc_errors = 0;
	uuid_manager: UUIDManager = new UUIDManager(32767, true);
	private supported_uuids: string[] = [...SUPPORTED_UUIDS];

	crc(): number {
		let checksum = 0;
		for (const d of this.deltas) for (const v of d.data) checksum += v;
		return checksum & 0xffffffff;
	}

	unpackSnapshot(snap: Buffer, deltatick: number, recvTick: number, wantedCrc?: number): { items: DeltaItem[]; recvTick: number } {
		const unpacker = new MsgUnpacker(snap);
		let deltaSnaps: { ack: number; Snapshot: ESnap }[] = [];

		if (deltatick === -1) {
			this.eSnapHolder = [];
			this.deltas = [];
		} else {
			this.eSnapHolder = this.eSnapHolder.filter(s => {
				if (s.ack === deltatick) deltaSnaps.push(s);
				return s.ack >= deltatick;
			});
		}

		if (snap.length === 0) {
			for (const s of this.eSnapHolder)
				if (s.ack === deltatick)
					this.eSnapHolder.push({ Snapshot: s.Snapshot, ack: recvTick });
			return { items: [], recvTick };
		}

		if (deltaSnaps.length === 0 && deltatick >= 0)
			return { items: [], recvTick: -1 };

		const oldDeltas = this.deltas;
		this.deltas = [];
		this._events = [];

		const numRemoved    = unpacker.unpackInt();
		const numItemDeltas = unpacker.unpackInt();
		unpacker.unpackInt();

		const deleted: number[] = [];
		for (let i = 0; i < numRemoved; i++) deleted.push(unpacker.unpackInt());

		for (let i = 0; i < numItemDeltas; i++) {
			const type_id = unpacker.unpackInt();
			const id = unpacker.unpackInt();
			const key = (type_id << 16) | id;

			const size = (type_id > 0 && type_id < ITEM_SIZES.length)
				? ITEM_SIZES[type_id]
				: unpacker.unpackInt();

			const rawDelta: number[] = [];
			for (let j = 0; j < size; j++) rawDelta.push(unpacker.unpackInt());

			let data = rawDelta;
			let changed = false;
			if (deltatick >= 0) {
				const base = deltaSnaps.find(s => s.Snapshot.Key === key);
				if (base !== undefined) { data = undiffItem(base.Snapshot.Data, rawDelta); changed = true; }
			}

			if (type_id === 0) {
				this.eSnapHolder.push({ Snapshot: { Key: key, Data: data }, ack: recvTick });
				this.deltas.push({ data, key, id, type_id, parsed: {} as Item });
				this._registerUUID(data, id);
				continue;
			}

			let parsed: Item | DDNetItem;
			if (!changed) {
				const cached = oldDeltas.find(d => d.key === key);
				parsed = (cached && arraysEqual(data, cached.data)) ? cached.parsed : parseItem(data, type_id, id, this.uuid_manager);
			} else {
				parsed = parseItem(data, type_id, id, this.uuid_manager);
			}

			this.eSnapHolder.push({ Snapshot: { Key: key, Data: data }, ack: recvTick });
			this.deltas.push({ data, key, id, type_id, parsed });
			if (type_id >= 13 && type_id <= 20) this._events.push({ type_id, parsed });
		}

		for (const base of deltaSnaps) {
			if (deleted.includes(base.Snapshot.Key)) continue;
			if (this.eSnapHolder.some(s => s.ack === recvTick && s.Snapshot.Key === base.Snapshot.Key)) continue;

			this.eSnapHolder.push({ Snapshot: base.Snapshot, ack: recvTick });
			const cached = oldDeltas.find(d => d.key === base.Snapshot.Key);
			if (cached && arraysEqual(base.Snapshot.Data, cached.data)) {
				this.deltas.push(cached);
			} else {
				const type_id = (base.Snapshot.Key >> 16) & 0xffff;
				const id =  base.Snapshot.Key & 0xffff;
				this.deltas.push({ data: base.Snapshot.Data, key: base.Snapshot.Key, id, type_id, parsed: parseItem(base.Snapshot.Data, type_id, id, this.uuid_manager) });
			}
		}

		const crc = this.crc();
		if (wantedCrc !== undefined && crc !== wantedCrc) {
			this.deltas = oldDeltas;
			this.crc_errors++;
			if (this.crc_errors > 5) {
				this.crc_errors = 0;
				this.eSnapHolder = [];
				this.deltas = [];
				return { items: this.deltas, recvTick: -1 };
			}
			return { items: this.deltas, recvTick: deltatick };
		}

		if (this.crc_errors > 0) this.crc_errors--;
		return { items: this.deltas, recvTick };
	}

	get events(): { type_id: number; parsed: Item | DDNetItem }[] { return this._events; }

	unpackFullSnapshot(buf: Buffer, recvTick: number): { items: DeltaItem[] } {
		const unpacker = new MsgUnpacker(buf);
		const ints: number[] = [];
		while (unpacker.remaining > 0) ints.push(unpacker.unpackInt());

		let idx = 0;
		const ri  = () => ints[idx++];
		const ru  = () => ints[idx++] >>> 0;

		const data_size = ri();
		const num_items = ri();
		const offsets: number[] = [];
		for (let i = 0; i < num_items; i++) offsets.push(ri());

		const items_base = idx;

		this.eSnapHolder = [];
		const newDeltas: DeltaItem[] = [];
		this._events = [];
		this.deltas = [];

		for (let i = 0; i < num_items; i++) {
			idx = items_base + (offsets[i] >> 2);

			const key = (ints[idx++] >>> 0);
			const type_id = (key >>> 16) & 0xffff;
			const id =  key & 0xffff;

			const end_byte = i + 1 < num_items ? offsets[i + 1] : data_size;
			const dataLen = (end_byte - offsets[i] - 4) >> 2;
			const data: number[] = [];
			for (let j = 0; j < dataLen; j++) data.push(ints[idx++]);

			const parsed = type_id === 0
				? ({} as Item)
				: parseItem(data, type_id, id, this.uuid_manager);

			if (type_id === 0) this._registerUUID(data, id);

			const storeKey = (type_id * 65536 + id) >>> 0;
			this.eSnapHolder.push({ Snapshot: { Key: storeKey, Data: data }, ack: recvTick });
			newDeltas.push({ data, key: storeKey, id, type_id, parsed });

			if (type_id >= 13 && type_id <= 20) this._events.push({ type_id, parsed });
		}

		this.deltas = newDeltas;
		return { items: this.deltas };
	}

	reset() {
		this.deltas = [];
		this.eSnapHolder = [];
		this._events = [];
		this.crc_errors = 0;
		this.uuid_manager = new UUIDManager(32767, true);
		this.supported_uuids = [...SUPPORTED_UUIDS];
	}

	private _registerUUID(data: number[], id: number): void {
		const hash = Buffer.from(data.flatMap(n => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]));
		for (let i = 0; i < this.supported_uuids.length; i++) {
			const name = this.supported_uuids[i];
			if (this.uuid_manager.LookupName(name)) continue;
			if (hash.compare(createTwMD5Hash(name)) === 0) {
				this.uuid_manager.RegisterName(name, id);
				this.supported_uuids.splice(i, 1);
				return;
			}
		}
	}
}

export default Snapshot;