import { MsgUnpacker, varintToLE, createTwMD5Hash, TW_UUIDS } from "@twlibn/core";

// https://github.com/heinrich5991/libtw2/blob/master/gamenet/generate/raw/ddnet-19.6.py
const UUID_SV_KILL_MSG_TEAM = createTwMD5Hash(TW_UUIDS.NETMSG_KILLMSGTEAM);
const UUID_SV_DDRACE_TIME = createTwMD5Hash(TW_UUIDS.NETMSG_DDRACE_TIME);
const UUID_SV_RECORD = createTwMD5Hash(TW_UUIDS.NETMSG_RECORD);
const UUID_SV_TEAMS_STATE = createTwMD5Hash(TW_UUIDS.NETMSG_TEAMS_STATE);
const UUID_SV_RACE_FINISH = createTwMD5Hash(TW_UUIDS.NETMSG_RACE_FINISH);
const UUID_SV_COMMAND_INFO = createTwMD5Hash(TW_UUIDS.NETMSG_COMMAND_INFO);
const UUID_SV_SERVER_ALERT = createTwMD5Hash(TW_UUIDS.NETMSG_SERVER_ALERT);
const UUID_SV_YOUR_VOTE = createTwMD5Hash(TW_UUIDS.NETMSG_YOUR_VOTE);

export const enum GameMsg {
	SV_MOTD = 1,
	SV_BROADCAST = 2,
	SV_CHAT = 3,
	SV_KILL_MSG = 4,
	SV_SOUND_GLOBAL = 5,
	SV_TUNE_PARAMS = 6,
	UNUSED = 7,
	SV_READY_TO_ENTER = 8,
	SV_WEAPON_PICKUP = 9,
	SV_EMOTICON = 10,
	SV_VOTE_CLEAR_OPTIONS = 11,
	SV_VOTE_OPTION_LIST_ADD = 12,
	SV_VOTE_OPTION_ADD = 13,
	SV_VOTE_OPTION_REMOVE = 14,
	SV_VOTE_SET = 15,
	SV_VOTE_STATUS = 16,
	CL_SAY = 17,
	CL_SET_TEAM = 18,
	CL_SET_SPECTATOR_MODE = 19,
	CL_START_INFO = 20,
	CL_CHANGE_INFO = 21,
	CL_KILL = 22,
	CL_EMOTICON = 23,
	CL_VOTE = 24,
	CL_CALL_VOTE = 25,
	CL_IS_DDNET_LEGACY = 26,
	SV_DDRACE_TIME_LEGACY = 27,
	SV_RECORD_LEGACY = 28,
	SV_TEAMS_STATE_LEGACY = 30,
	CL_SHOW_OTHERS_LEGACY = 31,
}

export const enum SysMsg {
	INFO = 1,
	MAP_CHANGE = 2,
	MAP_DATA = 3,
	CON_READY = 4,
	SNAP = 5,
	SNAP_EMPTY = 6,
	SNAP_SINGLE = 7,
	SNAP_SMALL = 8,
	INPUT_TIMING = 9,
	RCON_AUTH_STATUS = 10,
	RCON_LINE = 11,
	READY = 14,
	ENTER_GAME = 15,
	INPUT = 16,
	RCON_CMD = 17,
	RCON_AUTH = 18,
	REQUEST_MAP_DATA = 19,
	PING = 22,
	PING_REPLY = 23,
	RCON_CMD_ADD = 25,
	RCON_CMD_REM = 26,
}

export interface MsgSvMotd { kind: "SvMotd"; message: string }
export interface MsgSvBroadcast { kind: "SvBroadcast"; message: string }
export interface MsgSvChat { kind: "SvChat"; team: number; client_id: number; message: string }
export interface MsgSvKillMsg { kind: "SvKillMsg"; killer: number; victim: number; weapon: number; mode_special: number }
export interface MsgSvSoundGlobal { kind: "SvSoundGlobal"; sound_id: number }
export interface MsgSvReadyToEnter { kind: "SvReadyToEnter" }
export interface MsgSvWeaponPickup { kind: "SvWeaponPickup"; weapon: number }
export interface MsgSvEmoticon { kind: "SvEmoticon"; client_id: number; emoticon: number }
export interface MsgSvVoteClearOptions { kind: "SvVoteClearOptions" }
export interface MsgSvVoteOptionListAdd { kind: "SvVoteOptionListAdd"; num_options: number; options: string[] }
export interface MsgSvVoteOptionAdd { kind: "SvVoteOptionAdd"; description: string }
export interface MsgSvVoteOptionRemove { kind: "SvVoteOptionRemove"; description: string }
export interface MsgSvVoteSet { kind: "SvVoteSet"; timeout: number; description: string; reason: string }
export interface MsgSvVoteStatus { kind: "SvVoteStatus"; yes: number; no: number; pass: number; total: number }
export interface MsgClSay { kind: "ClSay"; team: boolean; message: string }
export interface MsgClSetTeam { kind: "ClSetTeam"; team: number }
export interface MsgClSetSpectatorMode { kind: "ClSetSpectatorMode"; spectator_id: number }
export interface MsgClKill { kind: "ClKill" }
export interface MsgClEmoticon { kind: "ClEmoticon"; emoticon: number }
export interface MsgClVote { kind: "ClVote"; value: number }
export interface MsgClCallVote { kind: "ClCallVote"; type: string; value: string; reason: string }
export interface MsgClIsDdnetLegacy { kind: "ClIsDdnetLegacy" }
export interface MsgSvDdraceTimeLegacy { kind: "SvDdraceTimeLegacy"; time: number; check: number }
export interface MsgSvRecordLegacy { kind: "SvRecordLegacy"; server_time_best: number; player_time_best: number }
export interface MsgSvTeamsStateLegacy { kind: "SvTeamsStateLegacy"; teams: number[] }

export interface MsgSvKillMsgTeam { kind: "SvKillMsgTeam"; team: number; first: number }
export interface MsgSvDdraceTime { kind: "SvDdraceTime"; time: number; check: number; finish: number }
export interface MsgSvRecord { kind: "SvRecord"; server_time_best: number; player_time_best: number }
export interface MsgSvTeamsState { kind: "SvTeamsState"; teams: number[] }
export interface MsgSvRaceFinish { kind: "SvRaceFinish"; client_id: number; time: number; diff: number; record_personal: boolean; record_server: boolean }
export interface MsgSvCommandInfo { kind: "SvCommandInfo"; name: string; args_format: string; help_text: string }
export interface MsgSvServerAlert { kind: "SvServerAlert"; message: string }
export interface MsgSvYourVote { kind: "SvYourVote"; voted: number }

export interface MsgSysMapChange { kind: "SysMapChange"; map_name: string; map_crc: number; map_size: number }
export interface MsgSysRconLine { kind: "SysRconLine"; line: string }
export interface MsgSysRconAuthStatus { kind: "SysRconAuthStatus"; auth_level: number; receive_commands: number }
export interface MsgSysInputTiming { kind: "SysInputTiming"; input_pred_tick: number; time_left: number }
export interface MsgSysPing { kind: "SysPing" }
export interface MsgSysPingReply { kind: "SysPingReply" }
export interface MsgSysConReady { kind: "SysConReady" }
export interface MsgSysRconCmdAdd { kind: "SysRconCmdAdd"; name: string; args_format: string; help_text: string }
export interface MsgSysRconCmdRem { kind: "SysRconCmdRem"; name: string }

export interface MsgUnknown { kind: "Unknown"; sys: boolean; msg_id: number; data: Buffer }

export type ParsedMessage =
	| MsgSvMotd | MsgSvBroadcast | MsgSvChat | MsgSvKillMsg | MsgSvSoundGlobal
	| MsgSvReadyToEnter | MsgSvWeaponPickup | MsgSvEmoticon
	| MsgSvVoteClearOptions | MsgSvVoteOptionListAdd | MsgSvVoteOptionAdd | MsgSvVoteOptionRemove
	| MsgSvVoteSet | MsgSvVoteStatus
	| MsgClSay | MsgClSetTeam | MsgClSetSpectatorMode | MsgClKill | MsgClEmoticon
	| MsgClVote | MsgClCallVote | MsgClIsDdnetLegacy
	| MsgSvDdraceTimeLegacy | MsgSvRecordLegacy | MsgSvTeamsStateLegacy
	| MsgSvKillMsgTeam | MsgSvDdraceTime | MsgSvRecord | MsgSvTeamsState
	| MsgSvRaceFinish | MsgSvCommandInfo | MsgSvServerAlert | MsgSvYourVote
	| MsgSysMapChange | MsgSysRconLine | MsgSysRconAuthStatus | MsgSysInputTiming
	| MsgSysPing | MsgSysPingReply | MsgSysConReady | MsgSysRconCmdAdd | MsgSysRconCmdRem
	| MsgUnknown;

function uuidEq(a: Buffer, b: Buffer): boolean {
	return a.compare(b) === 0;
}

export function parseMessage(data: Buffer): ParsedMessage {
	const first = data[0];
	const sys = (first & 1) === 1;
	let msg_id = first >>> 1;

	const payload = data.subarray(1);
	const u = new MsgUnpacker(payload);

	if (msg_id === 0) {
		if (payload.length < 16) return { kind: "Unknown", sys, msg_id: 0, data };
		const uuid_bytes = payload.subarray(0, 16);
		const rest = new MsgUnpacker(payload.subarray(16));

		if (uuidEq(uuid_bytes, UUID_SV_KILL_MSG_TEAM)) return { kind: "SvKillMsgTeam", team: rest.unpackInt(), first: rest.unpackInt() };
		if (uuidEq(uuid_bytes, UUID_SV_DDRACE_TIME)) return { kind: "SvDdraceTime", time: rest.unpackInt(), check: rest.unpackInt(), finish: rest.unpackInt() };
		if (uuidEq(uuid_bytes, UUID_SV_RECORD)) return { kind: "SvRecord", server_time_best: rest.unpackInt(), player_time_best: rest.unpackInt() };
		if (uuidEq(uuid_bytes, UUID_SV_RACE_FINISH)) return { kind: "SvRaceFinish", client_id: rest.unpackInt(), time: rest.unpackInt(), diff: rest.unpackInt(), record_personal: rest.unpackInt() !== 0, record_server: rest.unpackInt() !== 0 };
		if (uuidEq(uuid_bytes, UUID_SV_COMMAND_INFO)) return { kind: "SvCommandInfo", name: rest.unpackString(), args_format: rest.unpackString(), help_text: rest.unpackString() };
		if (uuidEq(uuid_bytes, UUID_SV_SERVER_ALERT)) return { kind: "SvServerAlert", message: rest.unpackString() };
		if (uuidEq(uuid_bytes, UUID_SV_YOUR_VOTE)) return { kind: "SvYourVote", voted: rest.unpackInt() };
		if (uuidEq(uuid_bytes, UUID_SV_TEAMS_STATE)) {
			const teams: number[] = [];
			for (let i = 0; i < 128; i++) teams.push(rest.unpackInt());
			return { kind: "SvTeamsState", teams };
		}
		return { kind: "Unknown", sys, msg_id: 0, data };
	}

	if (sys) {
		switch (msg_id) {
			case SysMsg.MAP_CHANGE: return { kind: "SysMapChange", map_name: u.unpackString(), map_crc: u.unpackInt(), map_size: u.unpackInt() };
			case SysMsg.CON_READY: return { kind: "SysConReady" };
			case SysMsg.INPUT_TIMING: return { kind: "SysInputTiming", input_pred_tick: u.unpackInt(), time_left: u.unpackInt() };
			case SysMsg.RCON_AUTH_STATUS: return { kind: "SysRconAuthStatus", auth_level: u.unpackInt(), receive_commands: u.unpackInt() };
			case SysMsg.RCON_LINE: return { kind: "SysRconLine", line: u.unpackString() };
			case SysMsg.PING: return { kind: "SysPing" };
			case SysMsg.PING_REPLY: return { kind: "SysPingReply" };
			case SysMsg.RCON_CMD_ADD: return { kind: "SysRconCmdAdd", name: u.unpackString(), args_format: u.unpackString(), help_text: u.unpackString() };
			case SysMsg.RCON_CMD_REM: return { kind: "SysRconCmdRem", name: u.unpackString() };
			default: return { kind: "Unknown", sys: true, msg_id, data };
		}
	} else {
		switch (msg_id) {
			case GameMsg.SV_MOTD: return { kind: "SvMotd", message: u.unpackString() };
			case GameMsg.SV_BROADCAST: return { kind: "SvBroadcast", message: u.unpackString() };
			case GameMsg.SV_CHAT: return { kind: "SvChat", team: u.unpackInt(), client_id: u.unpackInt(), message: u.unpackString() };
			case GameMsg.SV_KILL_MSG: return { kind: "SvKillMsg", killer: u.unpackInt(), victim: u.unpackInt(), weapon: u.unpackInt(), mode_special: u.unpackInt() };
			case GameMsg.SV_SOUND_GLOBAL: return { kind: "SvSoundGlobal", sound_id: u.unpackInt() };
			case GameMsg.SV_READY_TO_ENTER: return { kind: "SvReadyToEnter" };
			case GameMsg.SV_WEAPON_PICKUP: return { kind: "SvWeaponPickup", weapon: u.unpackInt() };
			case GameMsg.SV_EMOTICON: return { kind: "SvEmoticon", client_id: u.unpackInt(), emoticon: u.unpackInt() };
			case GameMsg.SV_VOTE_CLEAR_OPTIONS: return { kind: "SvVoteClearOptions" };
			case GameMsg.SV_VOTE_OPTION_LIST_ADD: {
				const num_options = u.unpackInt();
				const options: string[] = [];
				for (let i = 0; i < 15; i++) options.push(u.unpackString());
				return { kind: "SvVoteOptionListAdd", num_options, options: options.slice(0, num_options) };
			}
			case GameMsg.SV_VOTE_OPTION_ADD: return { kind: "SvVoteOptionAdd", description: u.unpackString() };
			case GameMsg.SV_VOTE_OPTION_REMOVE: return { kind: "SvVoteOptionRemove", description: u.unpackString() };
			case GameMsg.SV_VOTE_SET: return { kind: "SvVoteSet", timeout: u.unpackInt(), description: u.unpackString(), reason: u.unpackString() };
			case GameMsg.SV_VOTE_STATUS: return { kind: "SvVoteStatus", yes: u.unpackInt(), no: u.unpackInt(), pass: u.unpackInt(), total: u.unpackInt() };
			case GameMsg.CL_SAY: return { kind: "ClSay", team: u.unpackInt() !== 0, message: u.unpackString() };
			case GameMsg.CL_SET_TEAM: return { kind: "ClSetTeam", team: u.unpackInt() };
			case GameMsg.CL_SET_SPECTATOR_MODE: return { kind: "ClSetSpectatorMode", spectator_id: u.unpackInt() };
			case GameMsg.CL_KILL: return { kind: "ClKill" };
			case GameMsg.CL_EMOTICON: return { kind: "ClEmoticon", emoticon: u.unpackInt() };
			case GameMsg.CL_VOTE: return { kind: "ClVote", value: u.unpackInt() };
			case GameMsg.CL_CALL_VOTE: return { kind: "ClCallVote", type: u.unpackString(), value: u.unpackString(), reason: u.unpackString() };
			case GameMsg.CL_IS_DDNET_LEGACY: return { kind: "ClIsDdnetLegacy" };
			case GameMsg.SV_DDRACE_TIME_LEGACY: return { kind: "SvDdraceTimeLegacy", time: u.unpackInt(), check: u.unpackInt() };
			case GameMsg.SV_RECORD_LEGACY: return { kind: "SvRecordLegacy", server_time_best: u.unpackInt(), player_time_best: u.unpackInt() };
			case GameMsg.SV_TEAMS_STATE_LEGACY: {
				const teams: number[] = [];
				for (let i = 0; i < 64; i++) teams.push(u.unpackInt());
				return { kind: "SvTeamsStateLegacy", teams };
			}
			default: return { kind: "Unknown", sys: false, msg_id, data };
		}
	}
}

export function parseDemoMessage(raw: Buffer): ParsedMessage {
	return parseMessage(varintToLE(raw));
}