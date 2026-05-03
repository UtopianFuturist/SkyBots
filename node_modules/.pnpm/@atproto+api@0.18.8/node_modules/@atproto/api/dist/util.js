"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nuxSchema = void 0;
exports.sanitizeMutedWordValue = sanitizeMutedWordValue;
exports.savedFeedsToUriArrays = savedFeedsToUriArrays;
exports.getSavedFeedType = getSavedFeedType;
exports.validateSavedFeed = validateSavedFeed;
exports.validateNux = validateNux;
const zod_1 = require("zod");
const syntax_1 = require("@atproto/syntax");
function sanitizeMutedWordValue(value) {
    return (value
        .trim()
        .replace(/^#(?!\ufe0f)/, '')
        // eslint-disable-next-line no-misleading-character-class
        .replace(/[\r\n\u00AD\u2060\u200D\u200C\u200B]+/, ''));
}
function savedFeedsToUriArrays(savedFeeds) {
    const pinned = [];
    const saved = [];
    for (const feed of savedFeeds) {
        if (feed.pinned) {
            pinned.push(feed.value);
            // saved in v1 includes pinned
            saved.push(feed.value);
        }
        else {
            saved.push(feed.value);
        }
    }
    return {
        pinned,
        saved,
    };
}
/**
 * Get the type of a saved feed, used by deprecated methods for backwards
 * compat. Should not be used moving forward. *Invalid URIs will throw.*
 *
 * @param uri - The AT URI of the saved feed
 */
function getSavedFeedType(uri) {
    const urip = new syntax_1.AtUri(uri);
    switch (urip.collection) {
        case 'app.bsky.feed.generator':
            return 'feed';
        case 'app.bsky.graph.list':
            return 'list';
        default:
            return 'unknown';
    }
}
function validateSavedFeed(savedFeed) {
    if (!savedFeed.id) {
        throw new Error('Saved feed must have an `id` - use a TID');
    }
    if (['feed', 'list'].includes(savedFeed.type)) {
        const uri = new syntax_1.AtUri(savedFeed.value);
        const isFeed = uri.collection === 'app.bsky.feed.generator';
        const isList = uri.collection === 'app.bsky.graph.list';
        if (savedFeed.type === 'feed' && !isFeed) {
            throw new Error(`Saved feed of type 'feed' must be a feed, got ${uri.collection}`);
        }
        if (savedFeed.type === 'list' && !isList) {
            throw new Error(`Saved feed of type 'list' must be a list, got ${uri.collection}`);
        }
    }
}
exports.nuxSchema = zod_1.z
    .object({
    id: zod_1.z.string().max(64),
    completed: zod_1.z.boolean(),
    data: zod_1.z.string().max(300).optional(),
    expiresAt: zod_1.z.string().datetime().optional(),
})
    .strict();
function validateNux(nux) {
    exports.nuxSchema.parse(nux);
}
//# sourceMappingURL=util.js.map