import { SnapshotItemTypes } from "./item_types";

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