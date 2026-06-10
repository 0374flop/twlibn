export enum TileId {
    AIR = 0, SOLID = 1, DEATH = 2, NOHOOK = 3, NOLASER = 4,
    THROUGH_CUT = 5, THROUGH = 6, JUMP = 7, FREEZE = 9,
    TELEINEVIL = 10, UNFREEZE = 11, DFREEZE = 12, DUNFREEZE = 13,
    TELEINWEAPON = 14, TELEINHOOK = 15, WALLJUMP = 16,
    EHOOK_ENABLE = 17, EHOOK_DISABLE = 18,
    HIT_ENABLE = 19, HIT_DISABLE = 20,
    SOLO_ENABLE = 21, SOLO_DISABLE = 22,
}

export enum TilemapLayerType {
    TILES = 0, GAME = 1, TELE = 2, SPEEDUP = 4,
    FRONT = 8, SWITCH = 16, TUNE = 32,
}

export interface Tile { id: number; flags: number; }
export interface TeleTile { number: number; id: number; }
export interface SpeedupTile { force: number; max_speed: number; id: number; angle: number; }
export interface SwitchTile { number: number; id: number; flags: number; delay: number; }
export interface TuneTile { number: number; id: number; }

export interface QuadPoint { x: number; y: number; }
export interface QuadColor { r: number; g: number; b: number; a: number; }

export interface Quad {
    points: QuadPoint[];
    colors: QuadColor[];
    tex_coords: QuadPoint[];
    pos_env: number;
    pos_env_offset: number;
    color_env: number;
    color_env_offset: number;
}

export interface QuadLayer {
    name: string;
    detail: boolean;
    image_index: number;
    quads: Quad[];
}

export interface MapImage {
    width: number;
    height: number;
    external: boolean;
    name: string;
    data?: Uint8Array;
}

export interface TileLayer {
    width: number;
    height: number;
    layer_type: TilemapLayerType;
    name: string;
    detail: boolean;
    image_index: number;
    color: [number, number, number, number];
    color_env: number;
    color_env_offset: number;
    tiles?: Tile[][];
    tele_tiles?: TeleTile[][];
    speedup_tiles?: SpeedupTile[][];
    switch_tiles?: SwitchTile[][];
    tune_tiles?: TuneTile[][];
}

export interface LayerGroup {
    name: string;
    x_offset: number;
    y_offset: number;
    x_parallax: number;
    y_parallax: number;
    clipping: boolean;
    clip_x: number;
    clip_y: number;
    clip_w: number;
    clip_h: number;
    layers: (TileLayer | QuadLayer)[];
}

export interface MapInfo {
    datafile_version: number;
    images: MapImage[];
    groups: LayerGroup[];
    game_layer?: TileLayer;
    front_layer?: TileLayer;
    tele_layer?: TileLayer;
}
