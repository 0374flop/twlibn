import { deflateSync, inflateSync } from "zlib";
import { BufReader, BufWriter } from "@twlibn/core";

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
            const size = buf.readInt32LE(off + 4);

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

export function write_datafile(df: ParsedDatafile): Buffer {
    const all_items: RawItem[] = [];
    const type_entries: { type_id: number; start: number; num: number }[] = [];
    for (const [type_id, items] of df.items) {
        if (items.length === 0) continue;
        type_entries.push({ type_id, start: all_items.length, num: items.length });
        all_items.push(...items);
    }
    const items_w = new BufWriter();
    const item_offsets: number[] = [];
    for (const item of all_items) {
        item_offsets.push(items_w.size);
        const type_id__id = ((item.type_id & 0xffff) << 16) | (item.id & 0xffff);
        items_w.i32le(type_id__id);
        items_w.i32le(item.item_data.length * 4);
        for (const v of item.item_data) items_w.i32le(v);
    }
    const items_buf = items_w.build();
    const data_bufs: Buffer[] = df.data_items.map(d =>
        df.version === 4 ? deflateSync(d) : d
    );
    const data_offsets: number[] = [];
    const data_sizes: number[] = [];
    let data_off = 0;
    for (let i = 0; i < df.data_items.length; i++) {
        data_offsets.push(data_off);
        data_sizes.push(df.data_items[i].length);
        data_off += data_bufs[i].length;
    }
    const data_buf = Buffer.concat(data_bufs);
    const num_item_types = type_entries.length;
    const num_items = all_items.length;
    const num_data = df.data_items.length;
    const item_size = items_buf.length;
    const data_size = data_buf.length;
    const swaplen = 5 * 4 + num_item_types * 12 + num_items * 4 + num_data * 4 + (df.version === 4 ? num_data * 4 : 0);
    const size = swaplen + item_size + data_size;
    const w = new BufWriter();

    w.raw(Buffer.from('DATA', 'ascii'));
    w.i32le(df.version);

    w.i32le(size);
    w.i32le(swaplen);
    w.i32le(num_item_types);
    w.i32le(num_items);
    w.i32le(num_data);
    w.i32le(item_size);
    w.i32le(data_size);

    for (const t of type_entries) {
        w.i32le(t.type_id);
        w.i32le(t.start);
        w.i32le(t.num);
    }

    for (const o of item_offsets) w.i32le(o);
    for (const o of data_offsets) w.i32le(o);

    if (df.version === 4) {
        for (const s of data_sizes) w.i32le(s);
    }

    w.raw(items_buf);
    w.raw(data_buf);

    return w.build();
}