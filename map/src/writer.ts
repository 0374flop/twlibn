import { BufWriter, strToInts, createTwMD5Hash, TW_UUIDS } from "@twlibn/core";
import { write_datafile, ParsedDatafile, RawItem } from "./datafile";
import { MapInfo, TileLayer, QuadLayer, SoundLayer, SoundSource, TilemapLayerType, Tile, TeleTile, SpeedupTile, SwitchTile, TuneTile, Quad, Envelope, EnvelopePoint, AnyLayer } from "./types";
import { is_tile_layer, is_quad_layer, is_sound_layer } from "./map";

const ITEM_TYPE_VERSION = 0;
const ITEM_TYPE_INFO = 1;
const ITEM_TYPE_IMAGES = 2;
const ITEM_TYPE_ENVELOPES = 3;
const ITEM_TYPE_GROUPS = 4;
const ITEM_TYPE_LAYERS = 5;
const ITEM_TYPE_ENV_POINTS = 6;
const ITEM_TYPE_SOUNDS = 7;
const ITEM_TYPE_UUID_INDEX = 0xffff;

const LAYER_KIND_TILES = 2;
const LAYER_KIND_QUADS = 3;
const LAYER_KIND_SOUNDS = 10;

const AUTO_MAPPER_UUID_BYTES = createTwMD5Hash(TW_UUIDS.MAPITEMTYPE_AUTOMAPPER_CONFIG);
const ENV_POINTS_BEZIER_UUID_BYTES = createTwMD5Hash(TW_UUIDS.MAPITEMTYPE_ENVPOINTS_BEZIER);

export class MapWriter {
    static write(map: MapInfo): Buffer {
        const data_items: Buffer[] = [];
        const items = new Map<number, RawItem[]>();

        const push_item = (type_id: number, id: number, item_data: number[]) => {
            if (!items.has(type_id)) items.set(type_id, []);
            items.get(type_id)!.push({ type_id, id, item_data });
        };

        const push_data = (buf: Buffer): number => {
            data_items.push(buf);
            return data_items.length - 1;
        };

        const push_cstring = (s: string): number =>
            push_data(Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]));

        push_item(ITEM_TYPE_VERSION, 0, [1]);

        if (map.info) {
            const { author, version, credits, license, settings } = map.info;
            const d: number[] = [1];
            d.push(author ? push_cstring(author) : -1);
            d.push(version ? push_cstring(version) : -1);
            d.push(credits ? push_cstring(credits) : -1);
            d.push(license ? push_cstring(license) : -1);
            if (settings.length > 0) {
                const buf = Buffer.concat(settings.map(s =>
                    Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])])
                ));
                d.push(push_data(buf));
            } else {
                d.push(-1);
            }
            push_item(ITEM_TYPE_INFO, 0, d);
        }

        for (let i = 0; i < map.images.length; i++) {
            const img = map.images[i];
            const name_idx = push_cstring(img.name);
            const data_idx = img.external ? -1 : push_data(Buffer.from(img.data ?? new Uint8Array()));
            push_item(ITEM_TYPE_IMAGES, i, [1, img.width, img.height, img.external ? 1 : 0, name_idx, data_idx]);
        }

        for (let i = 0; i < map.sounds.length; i++) {
            const s = map.sounds[i];
            const name_idx = push_cstring(s.name);
            const data_idx = s.external ? -1 : push_data(s.data ?? Buffer.alloc(0));
            const data_size = s.data?.length ?? 0;
            push_item(ITEM_TYPE_SOUNDS, i, [1, s.external ? 1 : 0, name_idx, data_idx, data_size]);
        }

        const uuid_ints_from = (bytes: Buffer) => [
            bytes.readInt32BE(0),
            bytes.readInt32BE(4),
            bytes.readInt32BE(8),
            bytes.readInt32BE(12),
        ];

        const env_points_data: number[] = [];
        const env_bezier_data: number[] = [];
        let has_bezier = false;
        let point_count = 0;
        for (let i = 0; i < map.envelopes.length; i++) {
            const env = map.envelopes[i];
            const start = point_count;
            for (const pt of env.points) {
                env_points_data.push(pt.time, pt.curve_type, ...pt.values);
                env_bezier_data.push(
                    ...(pt.in_tangent_dx ?? [0,0,0,0]),
                    ...(pt.in_tangent_dy ?? [0,0,0,0]),
                    ...(pt.out_tangent_dx ?? [0,0,0,0]),
                    ...(pt.out_tangent_dy ?? [0,0,0,0]),
                );
                if (pt.in_tangent_dx || pt.in_tangent_dy || pt.out_tangent_dx || pt.out_tangent_dy)
                    has_bezier = true;
            }
            point_count += env.points.length;
            const name_ints = strToInts(env.name, 8);
            push_item(ITEM_TYPE_ENVELOPES, i, [2, env.channels, start, env.points.length, ...name_ints, env.synchronized ? 1 : 0]);
        }
        if (env_points_data.length > 0) {
            push_item(ITEM_TYPE_ENV_POINTS, 0, env_points_data);
        }
        if (has_bezier) {
            const bezier_type_id = 0x101;
            push_item(ITEM_TYPE_UUID_INDEX, bezier_type_id, uuid_ints_from(ENV_POINTS_BEZIER_UUID_BYTES));
            push_item(bezier_type_id, 0, env_bezier_data);
        }

        if (map.auto_mappers.length > 0) {
            const am_type_id = 0x100;
            push_item(ITEM_TYPE_UUID_INDEX, am_type_id, uuid_ints_from(AUTO_MAPPER_UUID_BYTES));
            for (let i = 0; i < map.auto_mappers.length; i++) {
                const am = map.auto_mappers[i];
                push_item(am_type_id, i, [0, am.group, am.layer, am.config, am.seed, am.automatic ? 1 : 0]);
            }
        }

        let layer_index = 0;
        for (let gi = 0; gi < map.groups.length; gi++) {
            const g = map.groups[gi];
            const start_layer = layer_index;

            for (const layer of g.layers) {
                const ld = this.serializeLayer(layer, data_items, push_data);
                push_item(ITEM_TYPE_LAYERS, layer_index++, ld);
            }

            const name_ints = strToInts(g.name, 3);
            push_item(ITEM_TYPE_GROUPS, gi, [
                3,
                g.x_offset, g.y_offset,
                g.x_parallax, g.y_parallax,
                start_layer, g.layers.length,
                g.clipping ? 1 : 0,
                g.clip_x, g.clip_y, g.clip_w, g.clip_h,
                ...name_ints,
            ]);
        }

        const df: ParsedDatafile = { version: map.datafile_version || 4, items, data_items };
        return write_datafile(df);
    }

    private static serializeLayer(layer: AnyLayer, _data_items: Buffer[], push_data: (b: Buffer) => number): number[] {
        if (is_tile_layer(layer)) return this.serializeTileLayer(layer, push_data);
        if (is_quad_layer(layer)) return this.serializeQuadLayer(layer, push_data);
        if (is_sound_layer(layer)) return this.serializeSoundLayer(layer, push_data);
        return [];
    }

    private static serializeTileLayer(layer: TileLayer, push_data: (b: Buffer) => number): number[] {
        const t = layer.layer_type;
        const layer_flags = layer.detail ? 1 : 0;
        const name_ints = strToInts(layer.name, 3);

        const has_real_tiles = t === TilemapLayerType.TILES || t === TilemapLayerType.GAME;
        const main_buf = has_real_tiles
            ? this.serializeTiles(layer.tiles ?? [], layer.width, layer.height)
            : Buffer.alloc(layer.width * layer.height * 4);

        const data_idx = push_data(main_buf);

        const tilemap_flags =
            t === TilemapLayerType.GAME ? 1 :
            t === TilemapLayerType.TELE ? 2 :
            t === TilemapLayerType.SPEEDUP ? 4 :
            t === TilemapLayerType.FRONT ? 8 :
            t === TilemapLayerType.SWITCH ? 16 :
            t === TilemapLayerType.TUNE ? 32 : 0;

        const d: number[] = [
            0,
            LAYER_KIND_TILES,
            layer_flags,
            3,
            layer.width,
            layer.height,
            tilemap_flags,
            layer.color[0], layer.color[1], layer.color[2], layer.color[3],
            layer.color_env,
            layer.color_env_offset,
            layer.image_index,
            data_idx,
            ...name_ints,
        ];

        d.push(t === TilemapLayerType.TELE ? push_data(this.serializeTeleTiles(layer.tele_tiles ?? [], layer.width, layer.height)) : -1);
        d.push(t === TilemapLayerType.SPEEDUP ? push_data(this.serializeSpeedupTiles(layer.speedup_tiles ?? [], layer.width, layer.height)) : -1);
        d.push(t === TilemapLayerType.FRONT ? push_data(this.serializeTiles(layer.tiles ?? [], layer.width, layer.height)) : -1);
        d.push(t === TilemapLayerType.SWITCH ? push_data(this.serializeSwitchTiles(layer.switch_tiles ?? [], layer.width, layer.height)) : -1);
        d.push(t === TilemapLayerType.TUNE ? push_data(this.serializeTuneTiles(layer.tune_tiles ?? [], layer.width, layer.height)) : -1);

        return d;
    }

    private static serializeQuadLayer(layer: QuadLayer, push_data: (b: Buffer) => number): number[] {
        const name_ints = strToInts(layer.name, 3);
        const flags = layer.detail ? 1 : 0;
        const data_idx = push_data(this.serializeQuads(layer.quads));
        return [0, LAYER_KIND_QUADS, flags, 2, layer.quads.length, data_idx, layer.image_index, ...name_ints];
    }

    private static serializeSoundLayer(layer: SoundLayer, push_data: (b: Buffer) => number): number[] {
        const name_ints = strToInts(layer.name, 3);
        const flags = layer.detail ? 1 : 0;
        const data_idx = push_data(this.serializeSoundSources(layer.sources));
        return [0, LAYER_KIND_SOUNDS, flags, 2, layer.sources.length, data_idx, layer.sound_index, ...name_ints];
    }

    private static serializeTiles(tiles: Tile[][], w: number, h: number): Buffer {
        const buf = Buffer.alloc(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = tiles[y]?.[x];
                const o = (y * w + x) * 4;
                buf[o] = t?.id ?? 0;
                buf[o + 1] = t?.flags ?? 0;
            }
        }
        return buf;
    }

    private static serializeTeleTiles(tiles: TeleTile[][], w: number, h: number): Buffer {
        const buf = Buffer.alloc(w * h * 2);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = tiles[y]?.[x];
                const o = (y * w + x) * 2;
                buf[o] = t?.number ?? 0;
                buf[o + 1] = t?.id ?? 0;
            }
        }
        return buf;
    }

    private static serializeSpeedupTiles(tiles: SpeedupTile[][], w: number, h: number): Buffer {
        const buf = Buffer.alloc(w * h * 6);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = tiles[y]?.[x];
                const o = (y * w + x) * 6;
                buf[o] = t?.force ?? 0;
                buf[o + 1] = t?.max_speed ?? 0;
                buf[o + 2] = t?.id ?? 0;
                buf[o + 3] = 0;
                buf.writeInt16LE(t?.angle ?? 0, o + 4);
            }
        }
        return buf;
    }

    private static serializeSwitchTiles(tiles: SwitchTile[][], w: number, h: number): Buffer {
        const buf = Buffer.alloc(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = tiles[y]?.[x];
                const o = (y * w + x) * 4;
                buf[o] = t?.number ?? 0;
                buf[o + 1] = t?.id ?? 0;
                buf[o + 2] = t?.flags ?? 0;
                buf[o + 3] = t?.delay ?? 0;
            }
        }
        return buf;
    }

    private static serializeTuneTiles(tiles: TuneTile[][], w: number, h: number): Buffer {
        const buf = Buffer.alloc(w * h * 2);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = tiles[y]?.[x];
                const o = (y * w + x) * 2;
                buf[o] = t?.number ?? 0;
                buf[o + 1] = t?.id ?? 0;
            }
        }
        return buf;
    }

    private static serializeQuads(quads: Quad[]): Buffer {
        const w = new BufWriter();
        if (quads.length === 0) {
            return Buffer.alloc(152);
        }
        for (const q of quads) {
            for (const p of q.points) { w.i32le(p.x); w.i32le(p.y); }
            for (const c of q.colors) { w.i32le(c.r); w.i32le(c.g); w.i32le(c.b); w.i32le(c.a); }
            for (const t of q.tex_coords) { w.i32le(t.x); w.i32le(t.y); }
            w.i32le(q.pos_env);
            w.i32le(q.pos_env_offset);
            w.i32le(q.color_env);
            w.i32le(q.color_env_offset);
        }
        return w.build();
    }

    private static serializeSoundSources(sources: SoundSource[]): Buffer {
        const w = new BufWriter();
        if (sources.length === 0) {
            return Buffer.alloc(52);
        }
        for (const s of sources) {
            w.i32le(s.x); w.i32le(s.y);
            w.i32le(s.looping ? 1 : 0);
            w.i32le(s.panning ? 1 : 0);
            w.i32le(s.delay);
            w.i32le(s.falloff);
            w.i32le(s.pos_env); w.i32le(s.pos_env_offset);
            w.i32le(s.sound_env); w.i32le(s.sound_env_offset);
            w.i32le(s.shape_kind);
            w.i32le(s.shape_width);
            w.i32le(s.shape_height);
        }
        return w.build();
    }

}
