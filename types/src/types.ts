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

    export interface Projectile {
        x: number;
        y: number;
        vel_x: number;
        vel_y: number;
        type_: number;
        start_tick: number;
    }

    export interface Laser {
        x: number;
        y: number;
        from_x: number;
        from_y: number;
        start_tick: number;
    }

    export interface Pickup {
        x: number;
        y: number;
        type_: number;
        subtype: number;
    }

    export interface Flag {
        x: number;
        y: number;
        team: number;
    }

    export interface GameInfo {
        game_flags: number;
        game_state_flags: number;
        round_start_tick: number;
        warmup_timer: number;
        score_limit: number;
        time_limit: number;
        round_num: number;
        round_current: number;
    }

    export interface GameData {
        teamscore_red: number;
        teamscore_blue: number;
        flag_carrier_red: number;
        flag_carrier_blue: number;
    }

    export interface CharacterCore {
        tick: number;
        x: number;
        y: number;
        vel_x: number;
        vel_y: number;
        angle: number;
        direction: number;
        jumped: number;
        hooked_player: number;
        hook_state: number;
        hook_tick: number;
        hook_x: number;
        hook_y: number;
        hook_dx: number;
        hook_dy: number;
    }

    export interface Character {
        character_core: CharacterCore;
        player_flags: number;
        health: number;
        armor: number;
        ammo_count: number;
        weapon: number;
        emote: number;
        attack_tick: number;
        client_id: number;
    }

    export interface PlayerInfo {
        local: number;
        client_id: number;
        team: number;
        score: number;
        latency: number;
    }

    export interface ClientInfo {
        name: string;
        clan: string;
        country: number;
        skin: string;
        use_custom_color: number;
        color_body: number;
        color_feet: number;
        id: number;
    }

    export interface SpectatorInfo {
        spectator_id: number;
        x: number;
        y: number;
    }

    export interface Common      { x: number; y: number; }
    export interface Explosion   { common: Common; }
    export interface Spawn       { common: Common; }
    export interface HammerHit   { common: Common; }
    export interface Death       { common: Common; client_id: number; }
    export interface SoundGlobal { common: Common; sound_id: number; }
    export interface SoundWorld  { common: Common; sound_id: number; }
    export interface DamageInd   { common: Common; angle: number; }

    
    export interface MyOwnObject { m_Test: number; }

    export interface DDNetCharacter {
        m_Flags: number;
        m_FreezeEnd: number;
        m_Jumps: number;
        m_TeleCheckpoint: number;
        m_StrongWeakID: number;
        m_JumpedTotal?: number;
        m_NinjaActivationTick?: number;
        m_FreezeStart?: number;
        m_TargetX?: number;
        m_TargetY?: number;
        id: number;
    }

    export interface DDNetPlayer {
        m_Flags: number;
        m_AuthLevel: number;
        id: number;
    }

    export interface GameInfoEx {
        m_Flags: number;
        m_Version: number;
        m_Flags2: number;
    }

    export interface DDNetProjectile {
        m_X: number;
        m_Y: number;
        m_Angle: number;
        m_Data: number;
        m_Type: number;
        m_StartTick: number;
    }

    export interface DDNetLaser {
        m_ToX: number;
        m_ToY: number;
        m_FromX: number;
        m_FromY: number;
        m_StartTick: number;
        m_Owner: number;
        m_Type: number;
    }
}

export type Item =
    | SnapshotItemTypes.PlayerInput
    | SnapshotItemTypes.PlayerInfo
    | SnapshotItemTypes.Projectile
    | SnapshotItemTypes.Laser
    | SnapshotItemTypes.Pickup
    | SnapshotItemTypes.Flag
    | SnapshotItemTypes.GameInfo
    | SnapshotItemTypes.GameData
    | SnapshotItemTypes.CharacterCore
    | SnapshotItemTypes.Character
    | SnapshotItemTypes.ClientInfo
    | SnapshotItemTypes.SpectatorInfo
    | SnapshotItemTypes.Common
    | SnapshotItemTypes.Explosion
    | SnapshotItemTypes.Spawn
    | SnapshotItemTypes.HammerHit
    | SnapshotItemTypes.Death
    | SnapshotItemTypes.SoundGlobal
    | SnapshotItemTypes.SoundWorld
    | SnapshotItemTypes.DamageInd;

export type DDNetItem =
    | SnapshotItemTypes.MyOwnObject
    | SnapshotItemTypes.DDNetCharacter
    | SnapshotItemTypes.DDNetPlayer
    | SnapshotItemTypes.GameInfoEx
    | SnapshotItemTypes.DDNetProjectile
    | SnapshotItemTypes.DDNetLaser;

export type DeltaItem = {
    data: number[];
    parsed: Item | DDNetItem;
    type_id: number;
    id: number;
    key: number;
};

export interface RconCommand {
    command: string;
    description: string;
    params: string;
}

export interface Chunk {
    bytes: number;
    flags: number;
    seq?: number;
    sys: boolean;
    msgid: number;
    msg: string;
    raw: Buffer;
    extended_msgid?: Buffer;
}

export interface Packet {
    twprotocol: { flags: number; ack: number; chunkAmount: number; size: number };
    chunks: Chunk[];
}

export interface Identity {
    name: string;
    clan: string;
    country: number;
    skin: string;
    use_custom_color: number;
    color_body: number;
    color_feet: number;
}

export interface ConnectionInfo {
    addr: string | null;
    port: number | null;
}

export interface ConnectionOptions {
    identity?: Identity;
    password?: string;
    ddnet_version?: { version: number; release_version: string };
    timeout?: number;
    NET_VERSION?: string;
    lightweight?: boolean;
    timeout_on_connecting?: boolean;
}

export const SERVER_TICK_SPEED = 50;
export const PHYS_SIZE = 28.0;

export const enum HookState {
    RETRACTED     = -1,
    IDLE          = 0,
    RETRACT_START = 1,
    RETRACT_END   = 3,
    FLYING        = 4,
    GRABBED       = 5,
}

export interface Hook {
    state: number;       
    pos_x: number;
    pos_y: number;
    dir_x: number;
    dir_y: number;
    tick: number;
    grabbed_id: number;  
}

export interface PhysicsState {
    x: number;
    y: number;
    vel_x: number;
    vel_y: number;
    hook: Hook;
    jumped: number;       
    jumped_total: number; 
    jumps: number;        
}

export interface Jumps {
    used_input: boolean;    
    all_air_used: boolean;  
    infinite: boolean;      
    last_refill: boolean;   
    total_air: number;      
    num_jumps: number;      
}

export interface Freeze {
    ticks_left: number;  
    freeze_tick: number; 
}

export const enum CantMove {
    NONE  = 0,
    UP    = 1 << 0,
    DOWN  = 1 << 1,
    LEFT  = 1 << 2,
    RIGHT = 1 << 3,
}

export interface CharacterState {
    
    freeze: Freeze;
    deep_freeze: boolean;  
    live_freeze: boolean;  

    
    solo: boolean;             
    hook_disabled: boolean;    
    tee_collision: boolean;    
    endless_hook: boolean;     

    
    weapon_hammer: boolean;
    weapon_shotgun: boolean;
    weapon_grenade: boolean;
    weapon_laser: boolean;

    
    telegun_gun: boolean;
    telegun_laser: boolean;
    telegun_grenade: boolean;

    
    jetpack: boolean;

    
    move_restrictions: number;

    
    tune_zone: number;
    tele_checkpoint: number;
    ddrace_state: 'none' | 'started' | 'finished';
    start_tick: number | null;

    
    jumps: Jumps;
}

export interface Player {
    client_id: number;

    
    client_info:     SnapshotItemTypes.ClientInfo      | null;
    player_info:     SnapshotItemTypes.PlayerInfo      | null;
    character:       SnapshotItemTypes.Character       | null;
    ddnet_character: SnapshotItemTypes.DDNetCharacter  | null;
    ddnet_player:    SnapshotItemTypes.DDNetPlayer     | null;

    
    physics: PhysicsState | null;

    
    game: CharacterState | null;

    
    input: SnapshotItemTypes.PlayerInput | null;
}

export type GameEvent =
    | { kind: 'explosion';        data: SnapshotItemTypes.Explosion  }
    | { kind: 'spawn';            data: SnapshotItemTypes.Spawn      }
    | { kind: 'hammerhit';        data: SnapshotItemTypes.HammerHit  }
    | { kind: 'death';            data: SnapshotItemTypes.Death      }
    | { kind: 'sound_global';     data: SnapshotItemTypes.SoundGlobal }
    | { kind: 'sound_world';      data: SnapshotItemTypes.SoundWorld }
    | { kind: 'damage_indicator'; data: SnapshotItemTypes.DamageInd  };

export interface World {
    tick: number;
    map_name: string;
    map_crc: number;

    
    game_info:    SnapshotItemTypes.GameInfo    | null;
    game_data:    SnapshotItemTypes.GameData    | null;
    game_info_ex: SnapshotItemTypes.GameInfoEx  | null;

    
    players: Record<number, Player>;

    
    projectiles:      SnapshotItemTypes.Projectile[];
    lasers:           SnapshotItemTypes.Laser[];
    pickups:          SnapshotItemTypes.Pickup[];
    flags:            SnapshotItemTypes.Flag[];
    ddnet_projectiles: SnapshotItemTypes.DDNetProjectile[];
    ddnet_lasers:     SnapshotItemTypes.DDNetLaser[];

    
    events: GameEvent[];
}

export type TileGetter = (tx: number, ty: number) => number;

const _w = { fire: 0, player_flags: 0, wanted_weapon: 0, next_weapon: 0, prev_weapon: 0 };
export const INPUT_LEFT:       SnapshotItemTypes.PlayerInput = { direction: -1, jump: false, hook: false, target_x: -1, target_y:  0, ..._w };
export const INPUT_RIGHT:      SnapshotItemTypes.PlayerInput = { direction:  1, jump: false, hook: false, target_x:  1, target_y:  0, ..._w };
export const INPUT_STOP:       SnapshotItemTypes.PlayerInput = { direction:  0, jump: false, hook: false, target_x:  0, target_y: -1, ..._w };
export const INPUT_JUMP_LEFT:  SnapshotItemTypes.PlayerInput = { direction: -1, jump: true,  hook: false, target_x: -1, target_y:  0, ..._w };
export const INPUT_JUMP_RIGHT: SnapshotItemTypes.PlayerInput = { direction:  1, jump: true,  hook: false, target_x:  1, target_y:  0, ..._w };
export const INPUT_JUMP:       SnapshotItemTypes.PlayerInput = { direction:  0, jump: true,  hook: false, target_x:  0, target_y: -1, ..._w };

export function defaultHook(x: number, y: number): Hook {
    return {
        state: HookState.IDLE,
        pos_x: x, pos_y: y,
        dir_x: 0, dir_y: -1,
        tick: 0,
        grabbed_id: -1,
    };
}

export function defaultPhysicsState(x: number, y: number): PhysicsState {
    return {
        x, y,
        vel_x: 0, vel_y: 0,
        hook: defaultHook(x, y),
        jumped: 0,
        jumped_total: 0,
        jumps: 2,
    };
}

export function defaultJumps(): Jumps {
    return {
        used_input: false,
        all_air_used: false,
        infinite: false,
        last_refill: false,
        total_air: 0,
        num_jumps: 2,
    };
}

export function defaultFreeze(): Freeze {
    return { ticks_left: 0, freeze_tick: 0 };
}

export function defaultCharacterState(): CharacterState {
    return {
        freeze: defaultFreeze(),
        deep_freeze: false,
        live_freeze: false,
        solo: false,
        hook_disabled: false,
        tee_collision: true,
        endless_hook: false,
        weapon_hammer: true,
        weapon_shotgun: true,
        weapon_grenade: true,
        weapon_laser: true,
        telegun_gun: false,
        telegun_laser: false,
        telegun_grenade: false,
        jetpack: false,
        move_restrictions: CantMove.NONE,
        tune_zone: 0,
        tele_checkpoint: 0,
        ddrace_state: 'none',
        start_tick: null,
        jumps: defaultJumps(),
    };
}

export function emptyWorld(tick: number, map_name = '', map_crc = 0): World {
    return {
        tick,
        map_name,
        map_crc,
        game_info: null,
        game_data: null,
        game_info_ex: null,
        players: {},
        projectiles: [],
        lasers: [],
        pickups: [],
        flags: [],
        ddnet_projectiles: [],
        ddnet_lasers: [],
        events: [],
    };
}

export type PlayerPhysicsState = PhysicsState;

export type PlayerTickState = Player;

export type WorldTickState = World;

export type TickEvent = GameEvent;

export type PhysicsWorldState = (PhysicsState | null)[];

export const defaultPlayerPhysicsState = defaultPhysicsState;

export const emptyWorldTickState = emptyWorld;
