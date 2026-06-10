import { inflateSync } from "zlib";
import { BufReader } from "@twlibn/core";

export interface ItemTypeEntry {
    type_id: number;
    start: number;
    num: number;
}

export interface RawItem {
    type_id: number;
    id: number;
    item_data: number[];
}

export interface ParsedDatafile {
    version: number;
    items: Map<number, RawItem[]>;
    data_items: Buffer[];
}

export function parse_datafile(buf: Buffer): ParsedDatafile {
    const r = new BufReader(buf);

    const magic = buf.slice(0, 4).toString("ascii");
    if (magic !== "DATA" && magic !== "ATAD") throw new Error(`Invalid map magic: "${magic}"`);

    r.raw(4);

    const version = r.i32le();
    if (version !== 3 && version !== 4) throw new Error(`Unsupported datafile version: ${version}`);

    r.i32le();
    r.i32le();

    const num_item_types = r.i32le();
    const num_items = r.i32le();
    const num_data = r.i32le();
    const item_block_size = r.i32le();
    const data_block_size = r.i32le();

    const item_types: ItemTypeEntry[] = [];
    for (let i = 0; i < num_item_types; i++) {
        item_types.push({ type_id: r.i32le(), start: r.i32le(), num: r.i32le() });
    }

    const item_offsets: number[] = [];
    for (let i = 0; i < num_items; i++) item_offsets.push(r.i32le());

    const data_offsets: number[] = [];
    for (let i = 0; i < num_data; i++) data_offsets.push(r.i32le());

    if (version === 4) {
        for (let i = 0; i < num_data; i++) r.i32le();
    }

    const items_start = r.pos;
    const items_by_type = new Map<number, RawItem[]>();

    for (const it of item_types) {
        const arr: RawItem[] = [];

        for (let i = 0; i < it.num; i++) {
            const off = items_start + item_offsets[it.start + i];
            const id = buf.readUInt16LE(off);
            const type_id = buf.readUInt16LE(off + 2);
            const size = buf.readInt32LE(off + 4); // item header не через BufReader т.к. используем абсолютные офсеты

            const item_data: number[] = [];
            for (let j = 0; j < size / 4; j++) {
                item_data.push(buf.readInt32LE(off + 8 + j * 4));
            }

            arr.push({ type_id, id, item_data });
        }

        items_by_type.set(it.type_id, arr);
    }

    const data_start = items_start + item_block_size;
    const raw_data = buf.slice(data_start, data_start + data_block_size);

    const data_items: Buffer[] = [];

    for (let i = 0; i < num_data; i++) {
        const off = data_offsets[i];
        const next_off = i + 1 < num_data ? data_offsets[i + 1] : data_block_size;
        const chunk = raw_data.slice(off, next_off);

        try { data_items.push(inflateSync(chunk)); } catch { data_items.push(chunk); }
    }

    return { version, items: items_by_type, data_items };
}
