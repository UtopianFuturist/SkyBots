/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { type $Typed } from '../../../../util';
import type * as AppBskyRichtextFacet from '../richtext/facet.js';
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js';
export interface Main {
    $type: 'app.bsky.feed.generator';
    did: string;
    displayName: string;
    description?: string;
    descriptionFacets?: AppBskyRichtextFacet.Main[];
    avatar?: BlobRef;
    /** Declaration that a feed accepts feedback interactions from a client through app.bsky.feed.sendInteractions */
    acceptsInteractions?: boolean;
    labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | {
        $type: string;
    };
    contentMode?: 'app.bsky.feed.defs#contentModeUnspecified' | 'app.bsky.feed.defs#contentModeVideo' | (string & {});
    createdAt: string;
    [k: string]: unknown;
}
export declare function isMain<V>(v: V): v is import("../../../../util").$TypedObject<V, "app.bsky.feed.generator", "main">;
export declare function validateMain<V>(v: V): ValidationResult<Main & V>;
export { type Main as Record, isMain as isRecord, validateMain as validateRecord, };
//# sourceMappingURL=generator.d.ts.map