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

    export interface Common { x: number; y: number; }
    export interface Explosion { common: Common; }
    export interface Spawn { common: Common; }
    export interface HammerHit { common: Common; }
    export interface Death { common: Common; client_id: number; }
    export interface SoundGlobal { common: Common; sound_id: number; }
    export interface SoundWorld { common: Common; sound_id: number; }
    export interface DamageInd { common: Common; angle: number; }

    export interface MyOwnObject { test: number; }

    export interface DDNetCharacter {
        flags: number;
        freeze_end: number;
        jumps: number;
        tele_checkpoint: number;
        strong_weak_id: number;
        jumped_total?: number;
        ninja_activation_tick?: number;
        freeze_start?: number;
        target_x?: number;
        target_y?: number;
        id: number;
    }

    export interface DDNetPlayer {
        flags: number;
        auth_level: number;
        id: number;
    }

    export interface GameInfoEx {
        flags: number;
        version: number;
        flags2: number;
    }

    export interface DDNetProjectile {
        x: number;
        y: number;
        angle: number;
        data: number;
        type_: number;
        start_tick: number;
    }

    export interface DDNetLaser {
        to_x: number;
        to_y: number;
        from_x: number;
        from_y: number;
        start_tick: number;
        owner: number;
        type_: number;
    }
}