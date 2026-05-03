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
    /** Optional filter by list purpose. If not specified, all supported types are returned. */
    purposes?: 'modlist' | 'curatelist' | (string & {})[];
};
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    listsWithMembership: ListWithMembership[];
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
/** A list and an optional list item indicating membership of a target user to that list. */
export interface ListWithMembership {
    $type?: 'app.bsky.graph.getListsWithMembership#listWithMembership';
    list: AppBskyGraphDefs.ListView;
    listItem?: AppBskyGraphDefs.ListItemView;
}
export declare function isListWithMembership<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.graph.getListsWithMembership", "listWithMembership">;
export declare function validateListWithMembership<V>(v: V): ValidationResult<ListWithMembership & V>;
//# sourceMappingURL=getListsWithMembership.d.ts.map