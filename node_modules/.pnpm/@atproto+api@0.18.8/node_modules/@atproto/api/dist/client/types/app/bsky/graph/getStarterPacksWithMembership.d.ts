/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { type ValidationResult } from '@atproto/lexicon';
import type * as AppBskyGraphDefs from './defs.js';
export type QueryParams = {
    /** The account (actor) to check for membership. */
    actor: string;
    limit?: number;
    cursor?: string;
};
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    starterPacksWithMembership: StarterPackWithMembership[];
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
/** A starter pack and an optional list item indicating membership of a target user to that starter pack. */
export interface StarterPackWithMembership {
    $type?: 'app.bsky.graph.getStarterPacksWithMembership#starterPackWithMembership';
    starterPack: AppBskyGraphDefs.StarterPackView;
    listItem?: AppBskyGraphDefs.ListItemView;
}
export declare function isStarterPackWithMembership<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.graph.getStarterPacksWithMembership", "starterPackWithMembership">;
export declare function validateStarterPackWithMembership<V>(v: V): ValidationResult<StarterPackWithMembership & V>;
//# sourceMappingURL=getStarterPacksWithMembership.d.ts.map