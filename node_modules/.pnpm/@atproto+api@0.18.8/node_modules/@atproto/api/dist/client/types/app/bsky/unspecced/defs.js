"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSkeletonSearchPost = isSkeletonSearchPost;
exports.validateSkeletonSearchPost = validateSkeletonSearchPost;
exports.isSkeletonSearchActor = isSkeletonSearchActor;
exports.validateSkeletonSearchActor = validateSkeletonSearchActor;
exports.isSkeletonSearchStarterPack = isSkeletonSearchStarterPack;
exports.validateSkeletonSearchStarterPack = validateSkeletonSearchStarterPack;
exports.isTrendingTopic = isTrendingTopic;
exports.validateTrendingTopic = validateTrendingTopic;
exports.isSkeletonTrend = isSkeletonTrend;
exports.validateSkeletonTrend = validateSkeletonTrend;
exports.isTrendView = isTrendView;
exports.validateTrendView = validateTrendView;
exports.isThreadItemPost = isThreadItemPost;
exports.validateThreadItemPost = validateThreadItemPost;
exports.isThreadItemNoUnauthenticated = isThreadItemNoUnauthenticated;
exports.validateThreadItemNoUnauthenticated = validateThreadItemNoUnauthenticated;
exports.isThreadItemNotFound = isThreadItemNotFound;
exports.validateThreadItemNotFound = validateThreadItemNotFound;
exports.isThreadItemBlocked = isThreadItemBlocked;
exports.validateThreadItemBlocked = validateThreadItemBlocked;
exports.isAgeAssuranceState = isAgeAssuranceState;
exports.validateAgeAssuranceState = validateAgeAssuranceState;
exports.isAgeAssuranceEvent = isAgeAssuranceEvent;
exports.validateAgeAssuranceEvent = validateAgeAssuranceEvent;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'app.bsky.unspecced.defs';
const hashSkeletonSearchPost = 'skeletonSearchPost';
function isSkeletonSearchPost(v) {
    return is$typed(v, id, hashSkeletonSearchPost);
}
function validateSkeletonSearchPost(v) {
    return validate(v, id, hashSkeletonSearchPost);
}
const hashSkeletonSearchActor = 'skeletonSearchActor';
function isSkeletonSearchActor(v) {
    return is$typed(v, id, hashSkeletonSearchActor);
}
function validateSkeletonSearchActor(v) {
    return validate(v, id, hashSkeletonSearchActor);
}
const hashSkeletonSearchStarterPack = 'skeletonSearchStarterPack';
function isSkeletonSearchStarterPack(v) {
    return is$typed(v, id, hashSkeletonSearchStarterPack);
}
function validateSkeletonSearchStarterPack(v) {
    return validate(v, id, hashSkeletonSearchStarterPack);
}
const hashTrendingTopic = 'trendingTopic';
function isTrendingTopic(v) {
    return is$typed(v, id, hashTrendingTopic);
}
function validateTrendingTopic(v) {
    return validate(v, id, hashTrendingTopic);
}
const hashSkeletonTrend = 'skeletonTrend';
function isSkeletonTrend(v) {
    return is$typed(v, id, hashSkeletonTrend);
}
function validateSkeletonTrend(v) {
    return validate(v, id, hashSkeletonTrend);
}
const hashTrendView = 'trendView';
function isTrendView(v) {
    return is$typed(v, id, hashTrendView);
}
function validateTrendView(v) {
    return validate(v, id, hashTrendView);
}
const hashThreadItemPost = 'threadItemPost';
function isThreadItemPost(v) {
    return is$typed(v, id, hashThreadItemPost);
}
function validateThreadItemPost(v) {
    return validate(v, id, hashThreadItemPost);
}
const hashThreadItemNoUnauthenticated = 'threadItemNoUnauthenticated';
function isThreadItemNoUnauthenticated(v) {
    return is$typed(v, id, hashThreadItemNoUnauthenticated);
}
function validateThreadItemNoUnauthenticated(v) {
    return validate(v, id, hashThreadItemNoUnauthenticated);
}
const hashThreadItemNotFound = 'threadItemNotFound';
function isThreadItemNotFound(v) {
    return is$typed(v, id, hashThreadItemNotFound);
}
function validateThreadItemNotFound(v) {
    return validate(v, id, hashThreadItemNotFound);
}
const hashThreadItemBlocked = 'threadItemBlocked';
function isThreadItemBlocked(v) {
    return is$typed(v, id, hashThreadItemBlocked);
}
function validateThreadItemBlocked(v) {
    return validate(v, id, hashThreadItemBlocked);
}
const hashAgeAssuranceState = 'ageAssuranceState';
function isAgeAssuranceState(v) {
    return is$typed(v, id, hashAgeAssuranceState);
}
function validateAgeAssuranceState(v) {
    return validate(v, id, hashAgeAssuranceState);
}
const hashAgeAssuranceEvent = 'ageAssuranceEvent';
function isAgeAssuranceEvent(v) {
    return is$typed(v, id, hashAgeAssuranceEvent);
}
function validateAgeAssuranceEvent(v) {
    return validate(v, id, hashAgeAssuranceEvent);
}
//# sourceMappingURL=defs.js.map