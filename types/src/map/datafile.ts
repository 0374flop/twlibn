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