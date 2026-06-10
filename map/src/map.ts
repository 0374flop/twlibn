import { parse_datafile, ParsedDatafile } from "./datafile";
import { intsToStr, BufReader } from "@twlibn/core";
import { MapInfo, MapInfoItem, MapVersion, MapImage, LayerGroup, TileLayer, QuadLayer, SoundLayer, SoundSource, TilemapLayerType, Tile, TileId, TeleTile, SpeedupTile, SwitchTile, TuneTile, Quad, QuadPoint, QuadColor, Envelope, EnvelopePoint, MapSound, AutoMapper, AnyLayer } from "./types";

const ITEM_TYPE_VERSION   = 0;
const ITEM_TYPE_INFO      = 1;
const ITEM_TYPE_IMAGES    = 2;
const ITEM_TYPE_ENVELOPES = 3;
const ITEM_TYPE_GROUPS    = 4;
const ITEM_TYPE_LAYERS    = 5;
const ITEM_TYPE_ENV_POINTS = 6;
const ITEM_TYPE_SOUNDS    = 7;
const ITEM_TYPE_UUID_INDEX = 0xffff;

const LAYER_KIND_TILES  = 2;
const LAYER_KIND_QUADS  = 3;
const LAYER_KIND_SOUNDS_DEPRECATED = 9;
const LAYER_KIND_SOUNDS = 10;

export function is_tile_layer(l: AnyLayer): l is TileLayer {
    return "layer_type" in l;
}

export function is_quad_layer(l: AnyLayer): l is QuadLayer {
    return "quads" in l;
}

export function is_sound_layer(l: AnyLayer): l is SoundLayer {
    return "sources" in l;
}

export class MapParser {
    static parse(buf: Buffer): MapInfo {
        return this.fromDatafile(parse_datafile(buf));
    }

    static get_tile(m: MapInfo, x: number, y: number) {
        return m.game_layer?.tiles?.[y]?.[x];
    }

    static is_solid(t?: Tile) { return t?.id === TileId.SOLID; }
    static is_nohook(t?: Tile) { return t?.id === TileId.NOHOOK || t?.id === TileId.THROUGH_CUT; }
    static is_freeze(t?: Tile) { return t?.id === TileId.FREEZE; }
    static is_dfreeze(t?: Tile) { return t?.id === TileId.DFREEZE; }
    static is_hookthrough(t?: Tile) { return t?.id === TileId.THROUGH || t?.id === TileId.THROUGH_CUT; }
    static is_death(t?: Tile) { return t?.id === TileId.DEATH; }
    static is_air(t?: Tile) { return !t || t.id === TileId.AIR; }

    static tile_name(id: number) {
        return TILE_NAMES[id] ?? `unknown(${id})`;
    }

    private static fromDatafile(df: ParsedDatafile): MapInfo {
        const result: MapInfo = {
            datafile_version: df.version,
            images: [],
            envelopes: [],
            sounds: [],
            groups: [],
            auto_mappers: [],
        };

        
        const version_items = df.items.get(ITEM_TYPE_VERSION) ?? [];
        if (version_items[0]) {
            result.map_version = { version: version_items[0].item_data[0] ?? 0 };
        }

        
        const info_items = df.items.get(ITEM_TYPE_INFO) ?? [];
        if (info_items[0]) {
            result.info = this.parseInfo(info_items[0].item_data, df);
        }

        const image_items = df.items.get(ITEM_TYPE_IMAGES) ?? [];

        for (const img of image_items) {
            const d = img.item_data;
            if (d.length < 6) continue;

            const external = d[3] !== 0;
            const name = this.getCString(df.data_items[d[4]]);
            const width = d[1];
            const height = d[2];

            const image: MapImage = { width, height, external, name };

            if (!external) {
                const raw = df.data_items[d[5]];
                if (raw) image.data = new Uint8Array(raw);
            }

            result.images.push(image);
        }

        const sound_items = df.items.get(ITEM_TYPE_SOUNDS) ?? [];
        for (const s of sound_items) {
            result.sounds.push(this.parseSound(s.item_data, df));
        }

        let auto_mapper_type_id = -1;
        let env_bezier_type_id = -1;
        const uuid_index_items = df.items.get(ITEM_TYPE_UUID_INDEX) ?? [];
        const AUTO_MAPPER_BYTES = Buffer.from('16271b3e8c1778399bd9b11ae041d0d8', 'hex');
        const ENV_BEZIER_BYTES = Buffer.from('3ab4f84dd9cc3c78b5850d6ccdb2e25c', 'hex');
        for (const u of uuid_index_items) {
            const d = u.item_data;
            if (d.length < 4) continue;
            const uuid_buf = Buffer.alloc(16);
            uuid_buf.writeInt32BE(d[0], 0);
            uuid_buf.writeInt32BE(d[1], 4);
            uuid_buf.writeInt32BE(d[2], 8);
            uuid_buf.writeInt32BE(d[3], 12);
            if (uuid_buf.equals(AUTO_MAPPER_BYTES)) {
                auto_mapper_type_id = u.id;
            } else if (uuid_buf.equals(ENV_BEZIER_BYTES)) {
                env_bezier_type_id = u.id;
            }
        }

        const env_point_items = df.items.get(ITEM_TYPE_ENV_POINTS) ?? [];
        const all_env_points: number[] = env_point_items[0]?.item_data ?? [];
        const envelope_items = df.items.get(ITEM_TYPE_ENVELOPES) ?? [];
        for (const env of envelope_items) {
            result.envelopes.push(this.parseEnvelope(env.item_data, all_env_points));
        }

        if (env_bezier_type_id !== -1) {
            const bezier_items = df.items.get(env_bezier_type_id) ?? [];
            const bezier_data = bezier_items[0]?.item_data ?? [];
            let pt_idx = 0;
            for (const env of result.envelopes) {
                for (const pt of env.points) {
                    const b = pt_idx * 16;
                    if (b + 16 <= bezier_data.length) {
                        pt.in_tangent_dx = [bezier_data[b], bezier_data[b+1], bezier_data[b+2], bezier_data[b+3]];
                        pt.in_tangent_dy = [bezier_data[b+4], bezier_data[b+5], bezier_data[b+6], bezier_data[b+7]];
                        pt.out_tangent_dx = [bezier_data[b+8], bezier_data[b+9], bezier_data[b+10], bezier_data[b+11]];
                        pt.out_tangent_dy = [bezier_data[b+12], bezier_data[b+13], bezier_data[b+14], bezier_data[b+15]];
                    }
                    pt_idx++;
                }
            }
        }

        if (auto_mapper_type_id !== -1) {
            const am_items = df.items.get(auto_mapper_type_id) ?? [];
            for (const am of am_items) {
                const d = am.item_data;
                if (d.length < 6) continue;
                result.auto_mappers.push({
                    group: d[1],
                    layer: d[2],
                    config: d[3],
                    seed: d[4],
                    automatic: (d[5] & 1) !== 0,
                });
            }
        }

        const group_items = df.items.get(ITEM_TYPE_GROUPS) ?? [];
        const layer_items = df.items.get(ITEM_TYPE_LAYERS) ?? [];

        for (const g of group_items) {
            const d = g.item_data;
            if (d.length < 7) continue;

            const gv = d[0];
            const start = d[5];
            const num = d[6];

            const clipping = gv >= 2 ? !!d[7] : false;
            const clip_x = gv >= 2 ? d[8] : 0;
            const clip_y = gv >= 2 ? d[9] : 0;
            const clip_w = gv >= 2 ? d[10] : 0;
            const clip_h = gv >= 2 ? d[11] : 0;

            const name =
                gv >= 3 && d.length >= 15
                    ? this.decode([d[12], d[13], d[14]])
                    : "";

            const group: LayerGroup = {
                name,
                x_offset: d[1],
                y_offset: d[2],
                x_parallax: d[3],
                y_parallax: d[4],
                clipping,
                clip_x, clip_y, clip_w, clip_h,
                layers: [],
            };

            for (let i = start; i < start + num; i++) {
                const li = layer_items[i];
                if (!li) continue;

                const ld = li.item_data;
                if (ld.length < 3) continue;

                const layer_kind = ld[1];

                if (layer_kind === LAYER_KIND_TILES) {
                    const layer = this.parseTileLayer(ld, df);
                    if (!layer) continue;
                    group.layers.push(layer);
                    if (layer.layer_type === TilemapLayerType.GAME) result.game_layer = layer;
                    if (layer.layer_type === TilemapLayerType.FRONT) result.front_layer = layer;
                    if (layer.layer_type === TilemapLayerType.TELE) result.tele_layer = layer;
                    if (layer.layer_type === TilemapLayerType.SPEEDUP) result.speedup_layer = layer;
                    if (layer.layer_type === TilemapLayerType.SWITCH) result.switch_layer = layer;
                    if (layer.layer_type === TilemapLayerType.TUNE) result.tune_layer = layer;
                } else if (layer_kind === LAYER_KIND_QUADS) {
                    const layer = this.parseQuadLayer(ld, df);
                    if (!layer) continue;
                    group.layers.push(layer);
                } else if (layer_kind === LAYER_KIND_SOUNDS || layer_kind === LAYER_KIND_SOUNDS_DEPRECATED) {
                    const layer = this.parseSoundLayer(ld, df, layer_kind === LAYER_KIND_SOUNDS_DEPRECATED);
                    if (!layer) continue;
                    group.layers.push(layer);
                }
            }

            result.groups.push(group);
        }

        return result;
    }

    private static parseTileLayer(ld: number[], df: ParsedDatafile): TileLayer | null {
        if (ld.length < 7) return null;

        const type = ld[6] as TilemapLayerType;
        if (![0, 1, 2, 4, 8, 16, 32].includes(type)) return null;

        const v = ld[3];
        const w = ld[4];
        const h = ld[5];
        const detail = (ld[2] & 1) !== 0;

        const color: [number, number, number, number] = [
            (ld[7] ?? 255) & 0xff,
            (ld[8] ?? 255) & 0xff,
            (ld[9] ?? 255) & 0xff,
            (ld[10] ?? 255) & 0xff,
        ];

        const color_env = ld[11] ?? -1;
        const color_env_off = ld[12] ?? 0;
        const image_index = ld[13] ?? -1;

        const name =
            v >= 3 && ld.length >= 18
                ? this.decode([ld[15], ld[16], ld[17]])
                : "";

        const data_idx  = this.tileDataIndex(type, v);
        const tile_buf  = df.data_items[ld[data_idx]];
        if (!tile_buf) return null;

        const compressed = (type === TilemapLayerType.GAME || type === TilemapLayerType.TILES) && v >= 4;

        const layer: TileLayer = {
            width: w, height: h,
            layer_type: type,
            name, detail,
            image_index,
            color,
            color_env,
            color_env_offset: color_env_off,
        };

        if (type === TilemapLayerType.GAME || type === TilemapLayerType.FRONT || type === TilemapLayerType.TILES)
            layer.tiles = this.parseTiles(tile_buf, w, h, compressed);
        else if (type === TilemapLayerType.TELE)
            layer.tele_tiles = this.parseTele(tile_buf, w, h);
        else if (type === TilemapLayerType.SPEEDUP)
            layer.speedup_tiles = this.parseSpeedup(tile_buf, w, h);
        else if (type === TilemapLayerType.SWITCH)
            layer.switch_tiles = this.parseSwitch(tile_buf, w, h);
        else if (type === TilemapLayerType.TUNE)
            layer.tune_tiles = this.parseTune(tile_buf, w, h);

        return layer;
    }

    private static parseInfo(d: number[], df: ParsedDatafile): MapInfoItem {
        const getString = (idx: number) => idx >= 0 ? this.getCString(df.data_items[idx]) : '';
        const author = getString(d[1] ?? -1);
        const version = getString(d[2] ?? -1);
        const credits = getString(d[3] ?? -1);
        const license = getString(d[4] ?? -1);
        const settings: string[] = [];
        const settings_idx = d[5] ?? -1;
        if (settings_idx >= 0) {
            const buf = df.data_items[settings_idx];
            if (buf) {
                let pos = 0;
                while (pos < buf.length) {
                    const end = buf.indexOf(0, pos);
                    if (end === -1) break;
                    if (end > pos) settings.push(buf.subarray(pos, end).toString('utf8'));
                    pos = end + 1;
                }
            }
        }
        return { author, version, credits, license, settings };
    }

    private static parseEnvelope(d: number[], all_points: number[]): Envelope {
        const version = d[0];
        const channels = d[1];
        const start = d[2];
        const num = d[3];
        const name = d.length >= 12 ? intsToStr([d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11]]) : '';
        const synchronized = version >= 2 ? d[12] !== 0 : false;

        const points: EnvelopePoint[] = [];

        for (let i = 0; i < num; i++) {
            const base = (start + i) * 6;
            if (base + 6 > all_points.length) break;
            points.push({
                time: all_points[base],
                curve_type: all_points[base + 1],
                values: [all_points[base+2] ?? 0, all_points[base+3] ?? 0, all_points[base+4] ?? 0, all_points[base+5] ?? 0],
            });
        }

        return { version, channels, name, synchronized, points };
    }

    private static parseSound(d: number[], df: ParsedDatafile): MapSound {
        const external = d[1] !== 0;
        const name = this.getCString(df.data_items[d[2] ?? -1]);
        const sound: MapSound = { external, name };
        if (!external && d[3] != null && d[3] >= 0) {
            sound.data = df.data_items[d[3]];
        }
        return sound;
    }

    private static parseSoundLayer(ld: number[], df: ParsedDatafile, deprecated: boolean): SoundLayer | null {
        if (ld.length < 8) return null;
        // ld[0] = _version (unused), ld[1] = type, ld[2] = flags, ld[3] = version
        const num_sources = ld[4];
        const data_idx = ld[5];
        const sound_index = ld[6] ?? -1;
        const detail = (ld[2] & 1) !== 0;
        const name = ld.length >= 10 ? this.decode([ld[7], ld[8], ld[9]]) : '';
        const buf = df.data_items[data_idx];
        if (!buf) return null;
        const sources = this.parseSoundSources(buf, num_sources, deprecated);
        return { name, detail, sound_index, sources };
    }

    private static parseSoundSources(buf: Buffer, num: number, deprecated: boolean): SoundSource[] {
        const stride = deprecated ? 36 : 52;
        const sources: SoundSource[] = [];
        for (let i = 0; i < num; i++) {
            const o = i * stride;
            if (o + stride > buf.length) break;
            const r = new BufReader(buf.subarray(o, o + stride));
            const x = r.i32le();
            const y = r.i32le();
            if (deprecated) {
                const looping = r.i32le() !== 0;
                const delay = r.i32le();
                const radius = r.i32le();
                const pos_env = r.i32le();
                const pos_env_offset = r.i32le();
                const sound_env = r.i32le();
                const sound_env_offset = r.i32le();
                sources.push({ x, y, looping, panning: true, delay, falloff: 0, pos_env, pos_env_offset, sound_env, sound_env_offset, shape_kind: 1, shape_width: radius, shape_height: 0 });
            } else {
                const looping = r.i32le() !== 0;
                const panning = r.i32le() !== 0;
                const delay = r.i32le();
                const falloff = r.i32le();
                const pos_env = r.i32le();
                const pos_env_offset = r.i32le();
                const sound_env = r.i32le();
                const sound_env_offset = r.i32le();
                const shape_kind = r.i32le();
                const shape_width = r.i32le();
                const shape_height = r.i32le();
                sources.push({ x, y, looping, panning, delay, falloff, pos_env, pos_env_offset, sound_env, sound_env_offset, shape_kind, shape_width, shape_height });
            }
        }
        return sources;
    }

    private static parseQuadLayer(ld: number[], df: ParsedDatafile): QuadLayer | null {
        if (ld.length < 7) return null;

        const v = ld[3];
        const num_quads = ld[4];
        const data_idx = ld[5];
        const image_index = ld[6] ?? -1;
        const detail = (ld[2] & 1) !== 0;

        const name =
            v >= 2 && ld.length >= 10
                ? this.decode([ld[7], ld[8], ld[9]])
                : "";

        const quad_buf = df.data_items[data_idx];
        if (!quad_buf) return null;

        return {
            name,
            detail,
            image_index,
            quads: this.parseQuads(quad_buf, num_quads),
        };
    }

    private static parseTiles(b: Buffer, w: number, h: number, compressed: boolean): Tile[][] {
        const total = w * h;
        const tiles: Tile[] = [];

        if (compressed) {
            for (let p = 0; tiles.length < total && p + 4 <= b.length;) {
                const id = b[p];
                const flags = b[p + 1];
                const skip = b[p + 2];
                p += 4;
                for (let i = 0; i <= skip && tiles.length < total; i++)
                    tiles.push({ id, flags });
            }
        } else {
            for (let i = 0; i + 4 <= b.length && tiles.length < total; i += 4)
                tiles.push({ id: b[i], flags: b[i + 1] });
        }

        return this.to2d(tiles, w);
    }

    private static parseTele(b: Buffer, w: number, h: number): TeleTile[][] {
        const tiles: TeleTile[] = [];
        for (let i = 0; i + 2 <= b.length && tiles.length < w * h; i += 2)
            tiles.push({ number: b[i], id: b[i + 1] });
        return this.to2d(tiles, w);
    }

    private static parseSpeedup(b: Buffer, w: number, h: number): SpeedupTile[][] {
        const n = w * h;
        const tiles: SpeedupTile[] = [];

        for (let i = 0; i < n; i++) {
            const o = i * 6;
            tiles.push({
                force: b[o],
                max_speed: b[o + 1],
                id: b[o + 2],
                angle: b.readInt16LE(o + 4),
            });
        }

        return this.to2d(tiles, w);
    }

    private static parseSwitch(b: Buffer, w: number, h: number): SwitchTile[][] {
        const n = w * h;
        const tiles: SwitchTile[] = [];

        for (let i = 0; i < n; i++) {
            const o = i * 4;
            tiles.push({
                number: b[o],
                id: b[o + 1] || 0,
                flags: b[o + 2] || 0,
                delay: b[o + 3] || 0,
            });
        }

        return this.to2d(tiles, w);
    }

    private static parseTune(b: Buffer, w: number, h: number): TuneTile[][] {
        const tiles: TuneTile[] = [];
        for (let i = 0; i + 2 <= b.length && tiles.length < w * h; i += 2)
            tiles.push({ number: b[i], id: b[i + 1] });
        return this.to2d(tiles, w);
    }

    private static parseQuads(b: Buffer, num: number): Quad[] {
        const QUAD_SIZE = 152;
        const quads: Quad[] = [];
        const r = new BufReader(b);

        for (let q = 0; q < num; q++) {
            if ((q + 1) * QUAD_SIZE > b.length) break;
            r.seek(q * QUAD_SIZE);

            const points: QuadPoint[] = [];
            for (let i = 0; i < 5; i++)
                points.push({ x: r.i32le(), y: r.i32le() });

            const colors: QuadColor[] = [];
            for (let i = 0; i < 4; i++)
                colors.push({ r: r.i32le() & 0xff, g: r.i32le() & 0xff, b: r.i32le() & 0xff, a: r.i32le() & 0xff });

            const tex_coords: QuadPoint[] = [];
            for (let i = 0; i < 4; i++)
                tex_coords.push({ x: r.i32le(), y: r.i32le() });

            quads.push({
                points, colors, tex_coords,
                pos_env: r.i32le(),
                pos_env_offset: r.i32le(),
                color_env: r.i32le(),
                color_env_offset: r.i32le(),
            });
        }

        return quads;
    }


    private static tileDataIndex(t: TilemapLayerType, v: number): number {
        if (t === TilemapLayerType.TILES || t === TilemapLayerType.GAME) return 14;

        const base = v >= 3 ? 18 : 15;

        switch (t) {
            case TilemapLayerType.TELE: return base;
            case TilemapLayerType.SPEEDUP: return base + 1;
            case TilemapLayerType.FRONT: return base + 2;
            case TilemapLayerType.SWITCH:  return base + 3;
            case TilemapLayerType.TUNE: return base + 4;
            default: return 14;
        }
    }

    private static getCString(buf: Buffer | undefined): string {
        if (!buf) return "";
        const r = new BufReader(buf);
        return r.cstring(buf.length);
    }


    private static decode(a: number[]): string {
        return intsToStr(a);
    }

    private static to2d<T>(a: T[], w: number): T[][] {
        const rows: T[][] = [];
        for (let y = 0; y < Math.ceil(a.length / w); y++)
            rows.push(a.slice(y * w, y * w + w));
        return rows;
    }
}

const TILE_NAMES: Record<number, string> = {
    0: "air",
    1: "solid",
    2: "death",
    3: "nohook",
    4: "nolaser",
    5: "through_cut",
    6: "through",
    7: "jump",
    9: "freeze",
    10: "tele_in_evil",
    11: "unfreeze",
    12: "deep_freeze",
    13: "deep_unfreeze",
    14: "tele_in_weapon",
    15: "tele_in_hook",
    16: "walljump",
    17: "ehook_enable",
    18: "ehook_disable",
    19: "hit_enable",
    20: "hit_disable",
    21: "solo_enable",
    22: "solo_disable",
};