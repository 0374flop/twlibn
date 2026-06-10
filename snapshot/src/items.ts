import { UUIDManager, intsToStr } from "@twlibn/core";

export namespace SnapshotItemTypes {
    export interface PlayerInput {
        direction: -1 | 0 | 1;
        target_x: number;
        target_y: number;
        jump: boolean;
        fire: number;
        hook: boolean;
        player_flags: number;
        wanted_weapon: number;
        next_weapon: number;
        prev_weapon: number;
    }
    export interface Projectile { x: number; y: number; vel_x: number; vel_y: number; type_: number; start_tick: number; }
    export interface Laser { x: number; y: number; from_x: number; from_y: number; start_tick: number; }
    export interface Pickup { x: number; y: number; type_: number; subtype: number; }
    export interface Flag { x: number; y: number; team: number; }
    export interface GameInfo { game_flags: number; game_state_flags: number; round_start_tick: number; warmup_timer: number; score_limit: number; time_limit: number; round_num: number; round_current: number; }
    export interface GameData { teamscore_red: number; teamscore_blue: number; flag_carrier_red: number; flag_carrier_blue: number; }
    export interface CharacterCore { tick: number; x: number; y: number; vel_x: number; vel_y: number; angle: number; direction: number; jumped: number; hooked_player: number; hook_state: number; hook_tick: number; hook_x: number; hook_y: number; hook_dx: number; hook_dy: number; }
    export interface Character { character_core: CharacterCore; player_flags: number; health: number; armor: number; ammo_count: number; weapon: number; emote: number; attack_tick: number; client_id: number; }
    export interface PlayerInfo { local: number; client_id: number; team: number; score: number; latency: number; }
    export interface ClientInfo { name: string; clan: string; country: number; skin: string; use_custom_color: number; color_body: number; color_feet: number; id: number; }
    export interface SpectatorInfo { spectator_id: number; x: number; y: number; }
    export interface Common { x: number; y: number; }
    export interface Explosion { common: Common; }
    export interface Spawn { common: Common; }
    export interface HammerHit { common: Common; }
    export interface Death { common: Common; client_id: number; }
    export interface SoundGlobal { common: Common; sound_id: number; }
    export interface SoundWorld { common: Common; sound_id: number; }
    export interface DamageInd { common: Common; angle: number; }
    export interface MyOwnObject { test: number; }
    export interface DDNetCharacter { flags: number; freeze_end: number; jumps: number; tele_checkpoint: number; strong_weak_id: number; jumped_total?: number; ninja_activation_tick?: number; freeze_start?: number; target_x?: number; target_y?: number; id: number; }
    export interface DDNetPlayer { flags: number; auth_level: number; id: number; }
    export interface GameInfoEx { flags: number; version: number; flags2: number; }
    export interface DDNetProjectile { x: number; y: number; angle: number; data: number; type_: number; start_tick: number; }
    export interface DDNetLaser { to_x: number; to_y: number; from_x: number; from_y: number; start_tick: number; owner: number; type_: number; }
}

export type Item =
    | SnapshotItemTypes.PlayerInput | SnapshotItemTypes.PlayerInfo
    | SnapshotItemTypes.Projectile | SnapshotItemTypes.Laser
    | SnapshotItemTypes.Pickup | SnapshotItemTypes.Flag
    | SnapshotItemTypes.GameInfo | SnapshotItemTypes.GameData
    | SnapshotItemTypes.CharacterCore | SnapshotItemTypes.Character
    | SnapshotItemTypes.ClientInfo | SnapshotItemTypes.SpectatorInfo
    | SnapshotItemTypes.Common | SnapshotItemTypes.Explosion
    | SnapshotItemTypes.Spawn | SnapshotItemTypes.HammerHit
    | SnapshotItemTypes.Death | SnapshotItemTypes.SoundGlobal
    | SnapshotItemTypes.SoundWorld | SnapshotItemTypes.DamageInd;

export type DDNetItem =
    | SnapshotItemTypes.MyOwnObject | SnapshotItemTypes.DDNetCharacter
    | SnapshotItemTypes.DDNetPlayer | SnapshotItemTypes.GameInfoEx
    | SnapshotItemTypes.DDNetProjectile | SnapshotItemTypes.DDNetLaser;

export type DeltaItem = {
    data: number[];
    parsed: Item | DDNetItem;
    type_id: number;
    id: number;
    key: number;
};

export interface ESnap { Key: number; Data: number[]; }

export const ITEM_SIZES: number[] = [
	0,
	10,
	6,
	5,
	4,
	3,
	8,
	4,
	15,
	22,
	5,
	17,
	3,
	2,
	2,
	2,
	2,
	3,
	3,
	3,
	3,
];

export const EVENT_TYPE_NAMES: Record<number, string> = {
	13: "common",
	14: "explosion",
	15: "spawn",
	16: "hammerhit",
	17: "death",
	18: "sound_global",
	19: "sound_world",
	20: "damage_indicator",
};

export const UUID_OFFSET = 0x4000;

export const SUPPORTED_UUIDS = [
	"my-own-object@heinrich5991.de",
	"character@netobj.ddnet.tw",
	"player@netobj.ddnet.tw",
	"gameinfo@netobj.ddnet.tw",
	"projectile@netobj.ddnet.tw",
	"laser@netobj.ddnet.tw",
] as const;

export type SupportedUUID = typeof SUPPORTED_UUIDS[number];

export function parseItem(data: number[], typeId: number, id: number, uuidMgr: UUIDManager): Item | DDNetItem {
	if (typeId >= UUID_OFFSET) {
		const name = uuidMgr.LookupType(typeId)?.name;
		if (name === "my-own-object@heinrich5991.de")
			return { test: data[0] } as SnapshotItemTypes.MyOwnObject;
		if (name === "character@netobj.ddnet.tw")
			return {
				flags: data[0], freeze_end: data[1], jumps: data[2],
				tele_checkpoint: data[3], strong_weak_id: data[4],
				jumped_total: data[5] ?? null, ninja_activation_tick: data[6] ?? null,
				freeze_start: data[7] ?? null, target_x: data[8] ?? null,
				target_y: data[9] ?? null, id,
			} as SnapshotItemTypes.DDNetCharacter;
		if (name === "player@netobj.ddnet.tw")
			return { flags: data[0], auth_level: data[1], id } as SnapshotItemTypes.DDNetPlayer;
		if (name === "gameinfo@netobj.ddnet.tw")
			return { flags: data[0], version: data[1], flags2: data[2] } as SnapshotItemTypes.GameInfoEx;
		if (name === "projectile@netobj.ddnet.tw")
			return { x: data[0], y: data[1], angle: data[2], data: data[3], type_: data[4], start_tick: data[5] } as SnapshotItemTypes.DDNetProjectile;
		if (name === "laser@netobj.ddnet.tw")
			return { to_x: data[0], to_y: data[1], from_x: data[2], from_y: data[3], start_tick: data[4], owner: data[5], type_: data[6] } as SnapshotItemTypes.DDNetLaser;
		return {} as Item;
	}

	switch (typeId) {
		case 1: return { direction: Math.sign(data[0]) as -1|0|1, target_x: data[1], target_y: data[2], jump: data[3] !== 0, fire: data[4], hook: data[5] !== 0, player_flags: data[6], wanted_weapon: data[7], next_weapon: data[8], prev_weapon: data[9] } as SnapshotItemTypes.PlayerInput;
		case 2: return { x: data[0], y: data[1], vel_x: data[2], vel_y: data[3], type_: data[4], start_tick: data[5] } as SnapshotItemTypes.Projectile;
		case 3: return { x: data[0], y: data[1], from_x: data[2], from_y: data[3], start_tick: data[4] } as SnapshotItemTypes.Laser;
		case 4: return { x: data[0], y: data[1], type_: data[2], subtype: data[3] } as SnapshotItemTypes.Pickup;
		case 5: return { x: data[0], y: data[1], team: data[2] } as SnapshotItemTypes.Flag;
		case 6: return { game_flags: data[0], game_state_flags: data[1], round_start_tick: data[2], warmup_timer: data[3], score_limit: data[4], time_limit: data[5], round_num: data[6], round_current: data[7] } as SnapshotItemTypes.GameInfo;
		case 7: return { teamscore_red: data[0], teamscore_blue: data[1], flag_carrier_red: data[2], flag_carrier_blue: data[3] } as SnapshotItemTypes.GameData;
		case 8: return { tick: data[0], x: data[1], y: data[2], vel_x: data[3], vel_y: data[4], angle: data[5], direction: data[6], jumped: data[7], hooked_player: data[8], hook_state: data[9], hook_tick: data[10], hook_x: data[11], hook_y: data[12], hook_dx: data[13], hook_dy: data[14] } as SnapshotItemTypes.CharacterCore;
		case 9: return {
			character_core: { tick: data[0], x: data[1], y: data[2], vel_x: data[3], vel_y: data[4], angle: data[5], direction: data[6], jumped: data[7], hooked_player: data[8], hook_state: data[9], hook_tick: data[10], hook_x: data[11], hook_y: data[12], hook_dx: data[13], hook_dy: data[14] } as SnapshotItemTypes.CharacterCore,
			player_flags: data[15], health: data[16], armor: data[17], ammo_count: data[18], weapon: data[19], emote: data[20], attack_tick: data[21], client_id: id,
		} as SnapshotItemTypes.Character;
		case 10: return { local: data[0], client_id: data[1], team: data[2], score: data[3], latency: data[4] } as SnapshotItemTypes.PlayerInfo;
		case 11: return { name: intsToStr([data[0], data[1], data[2], data[3]]), clan: intsToStr([data[4], data[5], data[6]]), country: data[7], skin: intsToStr([data[8], data[9], data[10], data[11], data[12], data[13]]), use_custom_color: data[14], color_body: data[15], color_feet: data[16], id } as SnapshotItemTypes.ClientInfo;
		case 12: return { spectator_id: data[0], x: data[1], y: data[2] } as SnapshotItemTypes.SpectatorInfo;
		case 13: return { x: data[0], y: data[1] } as SnapshotItemTypes.Common;
		case 14: return { common: { x: data[0], y: data[1] } } as SnapshotItemTypes.Explosion;
		case 15: return { common: { x: data[0], y: data[1] } } as SnapshotItemTypes.Spawn;
		case 16: return { common: { x: data[0], y: data[1] } } as SnapshotItemTypes.HammerHit;
		case 17: return { client_id: data[0], common: { x: data[1], y: data[2] } } as SnapshotItemTypes.Death;
		case 18: return { common: { x: data[0], y: data[1] }, sound_id: data[2] } as SnapshotItemTypes.SoundGlobal;
		case 19: return { common: { x: data[0], y: data[1] }, sound_id: data[2] } as SnapshotItemTypes.SoundWorld;
		case 20: return { angle: data[0], common: { x: data[1], y: data[2] } } as SnapshotItemTypes.DamageInd;
		default: return {} as Item;
	}
}