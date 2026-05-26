import { UUIDManager, intsToStr } from "@twlibn/core";
import { SnapshotItemTypes, Item, DDNetItem } from "./types";

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
			return { m_Test: data[0] } as SnapshotItemTypes.MyOwnObject;
		if (name === "character@netobj.ddnet.tw")
			return {
				m_Flags: data[0], m_FreezeEnd: data[1], m_Jumps: data[2],
				m_TeleCheckpoint: data[3], m_StrongWeakID: data[4],
				m_JumpedTotal: data[5] ?? null, m_NinjaActivationTick: data[6] ?? null,
				m_FreezeStart: data[7] ?? null, m_TargetX: data[8] ?? null,
				m_TargetY: data[9] ?? null, id,
			} as SnapshotItemTypes.DDNetCharacter;
		if (name === "player@netobj.ddnet.tw")
			return { m_Flags: data[0], m_AuthLevel: data[1], id } as SnapshotItemTypes.DDNetPlayer;
		if (name === "gameinfo@netobj.ddnet.tw")
			return { m_Flags: data[0], m_Version: data[1], m_Flags2: data[2] } as SnapshotItemTypes.GameInfoEx;
		if (name === "projectile@netobj.ddnet.tw")
			return { m_X: data[0], m_Y: data[1], m_Angle: data[2], m_Data: data[3], m_Type: data[4], m_StartTick: data[5] } as SnapshotItemTypes.DDNetProjectile;
		if (name === "laser@netobj.ddnet.tw")
			return { m_ToX: data[0], m_ToY: data[1], m_FromX: data[2], m_FromY: data[3], m_StartTick: data[4], m_Owner: data[5], m_Type: data[6] } as SnapshotItemTypes.DDNetLaser;
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