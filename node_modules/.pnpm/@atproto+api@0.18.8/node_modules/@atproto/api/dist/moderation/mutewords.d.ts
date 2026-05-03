import { AppBskyActorDefs, AppBskyRichtextFacet } from '../client';
export type MuteWordMatch = {
    /**
     * The `AppBskyActorDefs.MutedWord` that matched.
     */
    word: AppBskyActorDefs.MutedWord;
    /**
     * The string that matched the muted word.
     */
    predicate: string;
};
export type Params = {
    mutedWords: AppBskyActorDefs.MutedWord[];
    text: string;
    facets?: AppBskyRichtextFacet.Main[];
    outlineTags?: string[];
    languages?: string[];
    actor?: AppBskyActorDefs.ProfileView | AppBskyActorDefs.ProfileViewBasic;
};
/**
 * Checks if the given text matches any of the muted words, returning an array
 * of matches. If no matches are found, returns `undefined`.
 */
export declare function matchMuteWords({ mutedWords, text, facets, outlineTags, languages, actor, }: Params): MuteWordMatch[] | undefined;
/**
 * Checks if the given text matches any of the muted words, returning a boolean
 * if any matches are found.
 */
export declare function hasMutedWord(params: Params): boolean;
//# sourceMappingURL=mutewords.d.ts.map