"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppBskyFeedGetSuggestedFeeds = exports.AppBskyFeedGetRepostedBy = exports.AppBskyFeedGetQuotes = exports.AppBskyFeedGetPosts = exports.AppBskyFeedGetPostThread = exports.AppBskyFeedGetListFeed = exports.AppBskyFeedGetLikes = exports.AppBskyFeedGetFeedSkeleton = exports.AppBskyFeedGetFeedGenerators = exports.AppBskyFeedGetFeedGenerator = exports.AppBskyFeedGetFeed = exports.AppBskyFeedGetAuthorFeed = exports.AppBskyFeedGetActorLikes = exports.AppBskyFeedGetActorFeeds = exports.AppBskyFeedGenerator = exports.AppBskyFeedDescribeFeedGenerator = exports.AppBskyFeedDefs = exports.AppBskyEmbedVideo = exports.AppBskyEmbedRecordWithMedia = exports.AppBskyEmbedRecord = exports.AppBskyEmbedImages = exports.AppBskyEmbedExternal = exports.AppBskyEmbedDefs = exports.AppBskyContactVerifyPhone = exports.AppBskyContactStartPhoneVerification = exports.AppBskyContactSendNotification = exports.AppBskyContactRemoveData = exports.AppBskyContactImportContacts = exports.AppBskyContactGetSyncStatus = exports.AppBskyContactGetMatches = exports.AppBskyContactDismissMatch = exports.AppBskyContactDefs = exports.AppBskyBookmarkGetBookmarks = exports.AppBskyBookmarkDeleteBookmark = exports.AppBskyBookmarkDefs = exports.AppBskyBookmarkCreateBookmark = exports.AppBskyAgeassuranceGetState = exports.AppBskyAgeassuranceGetConfig = exports.AppBskyAgeassuranceDefs = exports.AppBskyAgeassuranceBegin = exports.AppBskyActorStatus = exports.AppBskyActorSearchActorsTypeahead = exports.AppBskyActorSearchActors = exports.AppBskyActorPutPreferences = exports.AppBskyActorProfile = exports.AppBskyActorGetSuggestions = exports.AppBskyActorGetProfiles = exports.AppBskyActorGetProfile = exports.AppBskyActorGetPreferences = exports.AppBskyActorDefs = void 0;
exports.AppBskyNotificationPutPreferences = exports.AppBskyNotificationPutActivitySubscription = exports.AppBskyNotificationListNotifications = exports.AppBskyNotificationListActivitySubscriptions = exports.AppBskyNotificationGetUnreadCount = exports.AppBskyNotificationGetPreferences = exports.AppBskyNotificationDefs = exports.AppBskyNotificationDeclaration = exports.AppBskyLabelerService = exports.AppBskyLabelerGetServices = exports.AppBskyLabelerDefs = exports.AppBskyGraphVerification = exports.AppBskyGraphUnmuteThread = exports.AppBskyGraphUnmuteActorList = exports.AppBskyGraphUnmuteActor = exports.AppBskyGraphStarterpack = exports.AppBskyGraphSearchStarterPacks = exports.AppBskyGraphMuteThread = exports.AppBskyGraphMuteActorList = exports.AppBskyGraphMuteActor = exports.AppBskyGraphListitem = exports.AppBskyGraphListblock = exports.AppBskyGraphList = exports.AppBskyGraphGetSuggestedFollowsByActor = exports.AppBskyGraphGetStarterPacksWithMembership = exports.AppBskyGraphGetStarterPacks = exports.AppBskyGraphGetStarterPack = exports.AppBskyGraphGetRelationships = exports.AppBskyGraphGetMutes = exports.AppBskyGraphGetListsWithMembership = exports.AppBskyGraphGetLists = exports.AppBskyGraphGetListMutes = exports.AppBskyGraphGetListBlocks = exports.AppBskyGraphGetList = exports.AppBskyGraphGetKnownFollowers = exports.AppBskyGraphGetFollows = exports.AppBskyGraphGetFollowers = exports.AppBskyGraphGetBlocks = exports.AppBskyGraphGetActorStarterPacks = exports.AppBskyGraphFollow = exports.AppBskyGraphDefs = exports.AppBskyGraphBlock = exports.AppBskyFeedThreadgate = exports.AppBskyFeedSendInteractions = exports.AppBskyFeedSearchPosts = exports.AppBskyFeedRepost = exports.AppBskyFeedPostgate = exports.AppBskyFeedPost = exports.AppBskyFeedLike = exports.AppBskyFeedGetTimeline = void 0;
exports.ChatBskyConvoSendMessage = exports.ChatBskyConvoRemoveReaction = exports.ChatBskyConvoMuteConvo = exports.ChatBskyConvoListConvos = exports.ChatBskyConvoLeaveConvo = exports.ChatBskyConvoGetMessages = exports.ChatBskyConvoGetLog = exports.ChatBskyConvoGetConvoForMembers = exports.ChatBskyConvoGetConvoAvailability = exports.ChatBskyConvoGetConvo = exports.ChatBskyConvoDeleteMessageForSelf = exports.ChatBskyConvoDefs = exports.ChatBskyConvoAddReaction = exports.ChatBskyConvoAcceptConvo = exports.ChatBskyActorExportAccountData = exports.ChatBskyActorDeleteAccount = exports.ChatBskyActorDefs = exports.ChatBskyActorDeclaration = exports.AppBskyVideoUploadVideo = exports.AppBskyVideoGetUploadLimits = exports.AppBskyVideoGetJobStatus = exports.AppBskyVideoDefs = exports.AppBskyUnspeccedSearchStarterPacksSkeleton = exports.AppBskyUnspeccedSearchPostsSkeleton = exports.AppBskyUnspeccedSearchActorsSkeleton = exports.AppBskyUnspeccedInitAgeAssurance = exports.AppBskyUnspeccedGetTrendsSkeleton = exports.AppBskyUnspeccedGetTrends = exports.AppBskyUnspeccedGetTrendingTopics = exports.AppBskyUnspeccedGetTaggedSuggestions = exports.AppBskyUnspeccedGetSuggestionsSkeleton = exports.AppBskyUnspeccedGetSuggestedUsersSkeleton = exports.AppBskyUnspeccedGetSuggestedUsers = exports.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton = exports.AppBskyUnspeccedGetSuggestedStarterPacks = exports.AppBskyUnspeccedGetSuggestedFeedsSkeleton = exports.AppBskyUnspeccedGetSuggestedFeeds = exports.AppBskyUnspeccedGetPostThreadV2 = exports.AppBskyUnspeccedGetPostThreadOtherV2 = exports.AppBskyUnspeccedGetPopularFeedGenerators = exports.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton = exports.AppBskyUnspeccedGetOnboardingSuggestedStarterPacks = exports.AppBskyUnspeccedGetConfig = exports.AppBskyUnspeccedGetAgeAssuranceState = exports.AppBskyUnspeccedDefs = exports.AppBskyRichtextFacet = exports.AppBskyNotificationUpdateSeen = exports.AppBskyNotificationUnregisterPush = exports.AppBskyNotificationRegisterPush = exports.AppBskyNotificationPutPreferencesV2 = void 0;
exports.ComAtprotoRepoPutRecord = exports.ComAtprotoRepoListRecords = exports.ComAtprotoRepoListMissingBlobs = exports.ComAtprotoRepoImportRepo = exports.ComAtprotoRepoGetRecord = exports.ComAtprotoRepoDescribeRepo = exports.ComAtprotoRepoDeleteRecord = exports.ComAtprotoRepoDefs = exports.ComAtprotoRepoCreateRecord = exports.ComAtprotoRepoApplyWrites = exports.ComAtprotoModerationDefs = exports.ComAtprotoModerationCreateReport = exports.ComAtprotoLexiconSchema = exports.ComAtprotoLexiconResolveLexicon = exports.ComAtprotoLabelSubscribeLabels = exports.ComAtprotoLabelQueryLabels = exports.ComAtprotoLabelDefs = exports.ComAtprotoIdentityUpdateHandle = exports.ComAtprotoIdentitySubmitPlcOperation = exports.ComAtprotoIdentitySignPlcOperation = exports.ComAtprotoIdentityResolveIdentity = exports.ComAtprotoIdentityResolveHandle = exports.ComAtprotoIdentityResolveDid = exports.ComAtprotoIdentityRequestPlcOperationSignature = exports.ComAtprotoIdentityRefreshIdentity = exports.ComAtprotoIdentityGetRecommendedDidCredentials = exports.ComAtprotoIdentityDefs = exports.ComAtprotoAdminUpdateSubjectStatus = exports.ComAtprotoAdminUpdateAccountSigningKey = exports.ComAtprotoAdminUpdateAccountPassword = exports.ComAtprotoAdminUpdateAccountHandle = exports.ComAtprotoAdminUpdateAccountEmail = exports.ComAtprotoAdminSendEmail = exports.ComAtprotoAdminSearchAccounts = exports.ComAtprotoAdminGetSubjectStatus = exports.ComAtprotoAdminGetInviteCodes = exports.ComAtprotoAdminGetAccountInfos = exports.ComAtprotoAdminGetAccountInfo = exports.ComAtprotoAdminEnableAccountInvites = exports.ComAtprotoAdminDisableInviteCodes = exports.ComAtprotoAdminDisableAccountInvites = exports.ComAtprotoAdminDeleteAccount = exports.ComAtprotoAdminDefs = exports.ChatBskyModerationUpdateActorAccess = exports.ChatBskyModerationGetMessageContext = exports.ChatBskyModerationGetActorMetadata = exports.ChatBskyConvoUpdateRead = exports.ChatBskyConvoUpdateAllRead = exports.ChatBskyConvoUnmuteConvo = exports.ChatBskyConvoSendMessageBatch = void 0;
exports.ComAtprotoTempFetchLabels = exports.ComAtprotoTempDereferenceScope = exports.ComAtprotoTempCheckSignupQueue = exports.ComAtprotoTempCheckHandleAvailability = exports.ComAtprotoTempAddReservedHandle = exports.ComAtprotoSyncSubscribeRepos = exports.ComAtprotoSyncRequestCrawl = exports.ComAtprotoSyncNotifyOfUpdate = exports.ComAtprotoSyncListReposByCollection = exports.ComAtprotoSyncListRepos = exports.ComAtprotoSyncListHosts = exports.ComAtprotoSyncListBlobs = exports.ComAtprotoSyncGetRepoStatus = exports.ComAtprotoSyncGetRepo = exports.ComAtprotoSyncGetRecord = exports.ComAtprotoSyncGetLatestCommit = exports.ComAtprotoSyncGetHostStatus = exports.ComAtprotoSyncGetHead = exports.ComAtprotoSyncGetCheckout = exports.ComAtprotoSyncGetBlocks = exports.ComAtprotoSyncGetBlob = exports.ComAtprotoSyncDefs = exports.ComAtprotoServerUpdateEmail = exports.ComAtprotoServerRevokeAppPassword = exports.ComAtprotoServerResetPassword = exports.ComAtprotoServerReserveSigningKey = exports.ComAtprotoServerRequestPasswordReset = exports.ComAtprotoServerRequestEmailUpdate = exports.ComAtprotoServerRequestEmailConfirmation = exports.ComAtprotoServerRequestAccountDelete = exports.ComAtprotoServerRefreshSession = exports.ComAtprotoServerListAppPasswords = exports.ComAtprotoServerGetSession = exports.ComAtprotoServerGetServiceAuth = exports.ComAtprotoServerGetAccountInviteCodes = exports.ComAtprotoServerDescribeServer = exports.ComAtprotoServerDeleteSession = exports.ComAtprotoServerDeleteAccount = exports.ComAtprotoServerDefs = exports.ComAtprotoServerDeactivateAccount = exports.ComAtprotoServerCreateSession = exports.ComAtprotoServerCreateInviteCodes = exports.ComAtprotoServerCreateInviteCode = exports.ComAtprotoServerCreateAppPassword = exports.ComAtprotoServerCreateAccount = exports.ComAtprotoServerConfirmEmail = exports.ComAtprotoServerCheckAccountStatus = exports.ComAtprotoServerActivateAccount = exports.ComAtprotoRepoUploadBlob = exports.ComAtprotoRepoStrongRef = void 0;
exports.ToolsOzoneTeamDeleteMember = exports.ToolsOzoneTeamDefs = exports.ToolsOzoneTeamAddMember = exports.ToolsOzoneSignatureSearchAccounts = exports.ToolsOzoneSignatureFindRelatedAccounts = exports.ToolsOzoneSignatureFindCorrelation = exports.ToolsOzoneSignatureDefs = exports.ToolsOzoneSettingUpsertOption = exports.ToolsOzoneSettingRemoveOptions = exports.ToolsOzoneSettingListOptions = exports.ToolsOzoneSettingDefs = exports.ToolsOzoneSetUpsertSet = exports.ToolsOzoneSetQuerySets = exports.ToolsOzoneSetGetValues = exports.ToolsOzoneSetDeleteValues = exports.ToolsOzoneSetDeleteSet = exports.ToolsOzoneSetDefs = exports.ToolsOzoneSetAddValues = exports.ToolsOzoneServerGetConfig = exports.ToolsOzoneSafelinkUpdateRule = exports.ToolsOzoneSafelinkRemoveRule = exports.ToolsOzoneSafelinkQueryRules = exports.ToolsOzoneSafelinkQueryEvents = exports.ToolsOzoneSafelinkDefs = exports.ToolsOzoneSafelinkAddRule = exports.ToolsOzoneReportDefs = exports.ToolsOzoneModerationSearchRepos = exports.ToolsOzoneModerationScheduleAction = exports.ToolsOzoneModerationQueryStatuses = exports.ToolsOzoneModerationQueryEvents = exports.ToolsOzoneModerationListScheduledActions = exports.ToolsOzoneModerationGetSubjects = exports.ToolsOzoneModerationGetRepos = exports.ToolsOzoneModerationGetReporterStats = exports.ToolsOzoneModerationGetRepo = exports.ToolsOzoneModerationGetRecords = exports.ToolsOzoneModerationGetRecord = exports.ToolsOzoneModerationGetEvent = exports.ToolsOzoneModerationGetAccountTimeline = exports.ToolsOzoneModerationEmitEvent = exports.ToolsOzoneModerationDefs = exports.ToolsOzoneModerationCancelScheduledActions = exports.ToolsOzoneHostingGetAccountHistory = exports.ToolsOzoneCommunicationUpdateTemplate = exports.ToolsOzoneCommunicationListTemplates = exports.ToolsOzoneCommunicationDeleteTemplate = exports.ToolsOzoneCommunicationDefs = exports.ToolsOzoneCommunicationCreateTemplate = exports.ComAtprotoTempRevokeAccountCredentials = exports.ComAtprotoTempRequestPhoneVerification = void 0;
exports.ChatBskyConvoNS = exports.ChatBskyActorDeclarationRecord = exports.ChatBskyActorNS = exports.ChatBskyNS = exports.ChatNS = exports.AppBskyVideoNS = exports.AppBskyUnspeccedNS = exports.AppBskyRichtextNS = exports.AppBskyNotificationDeclarationRecord = exports.AppBskyNotificationNS = exports.AppBskyLabelerServiceRecord = exports.AppBskyLabelerNS = exports.AppBskyGraphVerificationRecord = exports.AppBskyGraphStarterpackRecord = exports.AppBskyGraphListitemRecord = exports.AppBskyGraphListblockRecord = exports.AppBskyGraphListRecord = exports.AppBskyGraphFollowRecord = exports.AppBskyGraphBlockRecord = exports.AppBskyGraphNS = exports.AppBskyFeedThreadgateRecord = exports.AppBskyFeedRepostRecord = exports.AppBskyFeedPostgateRecord = exports.AppBskyFeedPostRecord = exports.AppBskyFeedLikeRecord = exports.AppBskyFeedGeneratorRecord = exports.AppBskyFeedNS = exports.AppBskyEmbedNS = exports.AppBskyContactNS = exports.AppBskyBookmarkNS = exports.AppBskyAgeassuranceNS = exports.AppBskyActorStatusRecord = exports.AppBskyActorProfileRecord = exports.AppBskyActorNS = exports.AppBskyNS = exports.AppNS = exports.AtpBaseClient = exports.TOOLS_OZONE_TEAM = exports.TOOLS_OZONE_REPORT = exports.TOOLS_OZONE_MODERATION = exports.COM_ATPROTO_MODERATION = exports.APP_BSKY_GRAPH = exports.APP_BSKY_FEED = exports.APP_BSKY_ACTOR = exports.ToolsOzoneVerificationRevokeVerifications = exports.ToolsOzoneVerificationListVerifications = exports.ToolsOzoneVerificationGrantVerifications = exports.ToolsOzoneVerificationDefs = exports.ToolsOzoneTeamUpdateMember = exports.ToolsOzoneTeamListMembers = void 0;
exports.ToolsOzoneVerificationNS = exports.ToolsOzoneTeamNS = exports.ToolsOzoneSignatureNS = exports.ToolsOzoneSettingNS = exports.ToolsOzoneSetNS = exports.ToolsOzoneServerNS = exports.ToolsOzoneSafelinkNS = exports.ToolsOzoneModerationNS = exports.ToolsOzoneHostingNS = exports.ToolsOzoneCommunicationNS = exports.ToolsOzoneNS = exports.ToolsNS = exports.ComAtprotoTempNS = exports.ComAtprotoSyncNS = exports.ComAtprotoServerNS = exports.ComAtprotoRepoNS = exports.ComAtprotoModerationNS = exports.ComAtprotoLexiconSchemaRecord = exports.ComAtprotoLexiconNS = exports.ComAtprotoLabelNS = exports.ComAtprotoIdentityNS = exports.ComAtprotoAdminNS = exports.ComAtprotoNS = exports.ComNS = exports.ChatBskyModerationNS = void 0;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const lexicons_js_1 = require("./lexicons.js");
const AppBskyAgeassuranceBegin = __importStar(require("./types/app/bsky/ageassurance/begin.js"));
const AppBskyBookmarkCreateBookmark = __importStar(require("./types/app/bsky/bookmark/createBookmark.js"));
const AppBskyBookmarkDeleteBookmark = __importStar(require("./types/app/bsky/bookmark/deleteBookmark.js"));
const AppBskyContactDismissMatch = __importStar(require("./types/app/bsky/contact/dismissMatch.js"));
const AppBskyContactGetMatches = __importStar(require("./types/app/bsky/contact/getMatches.js"));
const AppBskyContactGetSyncStatus = __importStar(require("./types/app/bsky/contact/getSyncStatus.js"));
const AppBskyContactImportContacts = __importStar(require("./types/app/bsky/contact/importContacts.js"));
const AppBskyContactRemoveData = __importStar(require("./types/app/bsky/contact/removeData.js"));
const AppBskyContactStartPhoneVerification = __importStar(require("./types/app/bsky/contact/startPhoneVerification.js"));
const AppBskyContactVerifyPhone = __importStar(require("./types/app/bsky/contact/verifyPhone.js"));
const AppBskyFeedGetActorLikes = __importStar(require("./types/app/bsky/feed/getActorLikes.js"));
const AppBskyFeedGetAuthorFeed = __importStar(require("./types/app/bsky/feed/getAuthorFeed.js"));
const AppBskyFeedGetFeed = __importStar(require("./types/app/bsky/feed/getFeed.js"));
const AppBskyFeedGetFeedSkeleton = __importStar(require("./types/app/bsky/feed/getFeedSkeleton.js"));
const AppBskyFeedGetListFeed = __importStar(require("./types/app/bsky/feed/getListFeed.js"));
const AppBskyFeedGetPostThread = __importStar(require("./types/app/bsky/feed/getPostThread.js"));
const AppBskyFeedSearchPosts = __importStar(require("./types/app/bsky/feed/searchPosts.js"));
const AppBskyGraphGetRelationships = __importStar(require("./types/app/bsky/graph/getRelationships.js"));
const AppBskyUnspeccedInitAgeAssurance = __importStar(require("./types/app/bsky/unspecced/initAgeAssurance.js"));
const AppBskyUnspeccedSearchActorsSkeleton = __importStar(require("./types/app/bsky/unspecced/searchActorsSkeleton.js"));
const AppBskyUnspeccedSearchPostsSkeleton = __importStar(require("./types/app/bsky/unspecced/searchPostsSkeleton.js"));
const AppBskyUnspeccedSearchStarterPacksSkeleton = __importStar(require("./types/app/bsky/unspecced/searchStarterPacksSkeleton.js"));
const ChatBskyConvoAddReaction = __importStar(require("./types/chat/bsky/convo/addReaction.js"));
const ChatBskyConvoRemoveReaction = __importStar(require("./types/chat/bsky/convo/removeReaction.js"));
const ComAtprotoIdentityRefreshIdentity = __importStar(require("./types/com/atproto/identity/refreshIdentity.js"));
const ComAtprotoIdentityResolveDid = __importStar(require("./types/com/atproto/identity/resolveDid.js"));
const ComAtprotoIdentityResolveHandle = __importStar(require("./types/com/atproto/identity/resolveHandle.js"));
const ComAtprotoIdentityResolveIdentity = __importStar(require("./types/com/atproto/identity/resolveIdentity.js"));
const ComAtprotoLexiconResolveLexicon = __importStar(require("./types/com/atproto/lexicon/resolveLexicon.js"));
const ComAtprotoRepoApplyWrites = __importStar(require("./types/com/atproto/repo/applyWrites.js"));
const ComAtprotoRepoCreateRecord = __importStar(require("./types/com/atproto/repo/createRecord.js"));
const ComAtprotoRepoDeleteRecord = __importStar(require("./types/com/atproto/repo/deleteRecord.js"));
const ComAtprotoRepoGetRecord = __importStar(require("./types/com/atproto/repo/getRecord.js"));
const ComAtprotoRepoPutRecord = __importStar(require("./types/com/atproto/repo/putRecord.js"));
const ComAtprotoServerConfirmEmail = __importStar(require("./types/com/atproto/server/confirmEmail.js"));
const ComAtprotoServerCreateAccount = __importStar(require("./types/com/atproto/server/createAccount.js"));
const ComAtprotoServerCreateAppPassword = __importStar(require("./types/com/atproto/server/createAppPassword.js"));
const ComAtprotoServerCreateSession = __importStar(require("./types/com/atproto/server/createSession.js"));
const ComAtprotoServerDeleteAccount = __importStar(require("./types/com/atproto/server/deleteAccount.js"));
const ComAtprotoServerGetAccountInviteCodes = __importStar(require("./types/com/atproto/server/getAccountInviteCodes.js"));
const ComAtprotoServerGetServiceAuth = __importStar(require("./types/com/atproto/server/getServiceAuth.js"));
const ComAtprotoServerListAppPasswords = __importStar(require("./types/com/atproto/server/listAppPasswords.js"));
const ComAtprotoServerRefreshSession = __importStar(require("./types/com/atproto/server/refreshSession.js"));
const ComAtprotoServerResetPassword = __importStar(require("./types/com/atproto/server/resetPassword.js"));
const ComAtprotoServerUpdateEmail = __importStar(require("./types/com/atproto/server/updateEmail.js"));
const ComAtprotoSyncGetBlob = __importStar(require("./types/com/atproto/sync/getBlob.js"));
const ComAtprotoSyncGetBlocks = __importStar(require("./types/com/atproto/sync/getBlocks.js"));
const ComAtprotoSyncGetHead = __importStar(require("./types/com/atproto/sync/getHead.js"));
const ComAtprotoSyncGetHostStatus = __importStar(require("./types/com/atproto/sync/getHostStatus.js"));
const ComAtprotoSyncGetLatestCommit = __importStar(require("./types/com/atproto/sync/getLatestCommit.js"));
const ComAtprotoSyncGetRecord = __importStar(require("./types/com/atproto/sync/getRecord.js"));
const ComAtprotoSyncGetRepo = __importStar(require("./types/com/atproto/sync/getRepo.js"));
const ComAtprotoSyncGetRepoStatus = __importStar(require("./types/com/atproto/sync/getRepoStatus.js"));
const ComAtprotoSyncListBlobs = __importStar(require("./types/com/atproto/sync/listBlobs.js"));
const ComAtprotoSyncRequestCrawl = __importStar(require("./types/com/atproto/sync/requestCrawl.js"));
const ComAtprotoTempCheckHandleAvailability = __importStar(require("./types/com/atproto/temp/checkHandleAvailability.js"));
const ComAtprotoTempDereferenceScope = __importStar(require("./types/com/atproto/temp/dereferenceScope.js"));
const ToolsOzoneCommunicationCreateTemplate = __importStar(require("./types/tools/ozone/communication/createTemplate.js"));
const ToolsOzoneCommunicationUpdateTemplate = __importStar(require("./types/tools/ozone/communication/updateTemplate.js"));
const ToolsOzoneModerationEmitEvent = __importStar(require("./types/tools/ozone/moderation/emitEvent.js"));
const ToolsOzoneModerationGetAccountTimeline = __importStar(require("./types/tools/ozone/moderation/getAccountTimeline.js"));
const ToolsOzoneModerationGetRecord = __importStar(require("./types/tools/ozone/moderation/getRecord.js"));
const ToolsOzoneModerationGetRepo = __importStar(require("./types/tools/ozone/moderation/getRepo.js"));
const ToolsOzoneSafelinkAddRule = __importStar(require("./types/tools/ozone/safelink/addRule.js"));
const ToolsOzoneSafelinkRemoveRule = __importStar(require("./types/tools/ozone/safelink/removeRule.js"));
const ToolsOzoneSafelinkUpdateRule = __importStar(require("./types/tools/ozone/safelink/updateRule.js"));
const ToolsOzoneSetDeleteSet = __importStar(require("./types/tools/ozone/set/deleteSet.js"));
const ToolsOzoneSetDeleteValues = __importStar(require("./types/tools/ozone/set/deleteValues.js"));
const ToolsOzoneSetGetValues = __importStar(require("./types/tools/ozone/set/getValues.js"));
const ToolsOzoneTeamAddMember = __importStar(require("./types/tools/ozone/team/addMember.js"));
const ToolsOzoneTeamDeleteMember = __importStar(require("./types/tools/ozone/team/deleteMember.js"));
const ToolsOzoneTeamUpdateMember = __importStar(require("./types/tools/ozone/team/updateMember.js"));
exports.AppBskyActorDefs = __importStar(require("./types/app/bsky/actor/defs.js"));
exports.AppBskyActorGetPreferences = __importStar(require("./types/app/bsky/actor/getPreferences.js"));
exports.AppBskyActorGetProfile = __importStar(require("./types/app/bsky/actor/getProfile.js"));
exports.AppBskyActorGetProfiles = __importStar(require("./types/app/bsky/actor/getProfiles.js"));
exports.AppBskyActorGetSuggestions = __importStar(require("./types/app/bsky/actor/getSuggestions.js"));
exports.AppBskyActorProfile = __importStar(require("./types/app/bsky/actor/profile.js"));
exports.AppBskyActorPutPreferences = __importStar(require("./types/app/bsky/actor/putPreferences.js"));
exports.AppBskyActorSearchActors = __importStar(require("./types/app/bsky/actor/searchActors.js"));
exports.AppBskyActorSearchActorsTypeahead = __importStar(require("./types/app/bsky/actor/searchActorsTypeahead.js"));
exports.AppBskyActorStatus = __importStar(require("./types/app/bsky/actor/status.js"));
exports.AppBskyAgeassuranceBegin = __importStar(require("./types/app/bsky/ageassurance/begin.js"));
exports.AppBskyAgeassuranceDefs = __importStar(require("./types/app/bsky/ageassurance/defs.js"));
exports.AppBskyAgeassuranceGetConfig = __importStar(require("./types/app/bsky/ageassurance/getConfig.js"));
exports.AppBskyAgeassuranceGetState = __importStar(require("./types/app/bsky/ageassurance/getState.js"));
exports.AppBskyBookmarkCreateBookmark = __importStar(require("./types/app/bsky/bookmark/createBookmark.js"));
exports.AppBskyBookmarkDefs = __importStar(require("./types/app/bsky/bookmark/defs.js"));
exports.AppBskyBookmarkDeleteBookmark = __importStar(require("./types/app/bsky/bookmark/deleteBookmark.js"));
exports.AppBskyBookmarkGetBookmarks = __importStar(require("./types/app/bsky/bookmark/getBookmarks.js"));
exports.AppBskyContactDefs = __importStar(require("./types/app/bsky/contact/defs.js"));
exports.AppBskyContactDismissMatch = __importStar(require("./types/app/bsky/contact/dismissMatch.js"));
exports.AppBskyContactGetMatches = __importStar(require("./types/app/bsky/contact/getMatches.js"));
exports.AppBskyContactGetSyncStatus = __importStar(require("./types/app/bsky/contact/getSyncStatus.js"));
exports.AppBskyContactImportContacts = __importStar(require("./types/app/bsky/contact/importContacts.js"));
exports.AppBskyContactRemoveData = __importStar(require("./types/app/bsky/contact/removeData.js"));
exports.AppBskyContactSendNotification = __importStar(require("./types/app/bsky/contact/sendNotification.js"));
exports.AppBskyContactStartPhoneVerification = __importStar(require("./types/app/bsky/contact/startPhoneVerification.js"));
exports.AppBskyContactVerifyPhone = __importStar(require("./types/app/bsky/contact/verifyPhone.js"));
exports.AppBskyEmbedDefs = __importStar(require("./types/app/bsky/embed/defs.js"));
exports.AppBskyEmbedExternal = __importStar(require("./types/app/bsky/embed/external.js"));
exports.AppBskyEmbedImages = __importStar(require("./types/app/bsky/embed/images.js"));
exports.AppBskyEmbedRecord = __importStar(require("./types/app/bsky/embed/record.js"));
exports.AppBskyEmbedRecordWithMedia = __importStar(require("./types/app/bsky/embed/recordWithMedia.js"));
exports.AppBskyEmbedVideo = __importStar(require("./types/app/bsky/embed/video.js"));
exports.AppBskyFeedDefs = __importStar(require("./types/app/bsky/feed/defs.js"));
exports.AppBskyFeedDescribeFeedGenerator = __importStar(require("./types/app/bsky/feed/describeFeedGenerator.js"));
exports.AppBskyFeedGenerator = __importStar(require("./types/app/bsky/feed/generator.js"));
exports.AppBskyFeedGetActorFeeds = __importStar(require("./types/app/bsky/feed/getActorFeeds.js"));
exports.AppBskyFeedGetActorLikes = __importStar(require("./types/app/bsky/feed/getActorLikes.js"));
exports.AppBskyFeedGetAuthorFeed = __importStar(require("./types/app/bsky/feed/getAuthorFeed.js"));
exports.AppBskyFeedGetFeed = __importStar(require("./types/app/bsky/feed/getFeed.js"));
exports.AppBskyFeedGetFeedGenerator = __importStar(require("./types/app/bsky/feed/getFeedGenerator.js"));
exports.AppBskyFeedGetFeedGenerators = __importStar(require("./types/app/bsky/feed/getFeedGenerators.js"));
exports.AppBskyFeedGetFeedSkeleton = __importStar(require("./types/app/bsky/feed/getFeedSkeleton.js"));
exports.AppBskyFeedGetLikes = __importStar(require("./types/app/bsky/feed/getLikes.js"));
exports.AppBskyFeedGetListFeed = __importStar(require("./types/app/bsky/feed/getListFeed.js"));
exports.AppBskyFeedGetPostThread = __importStar(require("./types/app/bsky/feed/getPostThread.js"));
exports.AppBskyFeedGetPosts = __importStar(require("./types/app/bsky/feed/getPosts.js"));
exports.AppBskyFeedGetQuotes = __importStar(require("./types/app/bsky/feed/getQuotes.js"));
exports.AppBskyFeedGetRepostedBy = __importStar(require("./types/app/bsky/feed/getRepostedBy.js"));
exports.AppBskyFeedGetSuggestedFeeds = __importStar(require("./types/app/bsky/feed/getSuggestedFeeds.js"));
exports.AppBskyFeedGetTimeline = __importStar(require("./types/app/bsky/feed/getTimeline.js"));
exports.AppBskyFeedLike = __importStar(require("./types/app/bsky/feed/like.js"));
exports.AppBskyFeedPost = __importStar(require("./types/app/bsky/feed/post.js"));
exports.AppBskyFeedPostgate = __importStar(require("./types/app/bsky/feed/postgate.js"));
exports.AppBskyFeedRepost = __importStar(require("./types/app/bsky/feed/repost.js"));
exports.AppBskyFeedSearchPosts = __importStar(require("./types/app/bsky/feed/searchPosts.js"));
exports.AppBskyFeedSendInteractions = __importStar(require("./types/app/bsky/feed/sendInteractions.js"));
exports.AppBskyFeedThreadgate = __importStar(require("./types/app/bsky/feed/threadgate.js"));
exports.AppBskyGraphBlock = __importStar(require("./types/app/bsky/graph/block.js"));
exports.AppBskyGraphDefs = __importStar(require("./types/app/bsky/graph/defs.js"));
exports.AppBskyGraphFollow = __importStar(require("./types/app/bsky/graph/follow.js"));
exports.AppBskyGraphGetActorStarterPacks = __importStar(require("./types/app/bsky/graph/getActorStarterPacks.js"));
exports.AppBskyGraphGetBlocks = __importStar(require("./types/app/bsky/graph/getBlocks.js"));
exports.AppBskyGraphGetFollowers = __importStar(require("./types/app/bsky/graph/getFollowers.js"));
exports.AppBskyGraphGetFollows = __importStar(require("./types/app/bsky/graph/getFollows.js"));
exports.AppBskyGraphGetKnownFollowers = __importStar(require("./types/app/bsky/graph/getKnownFollowers.js"));
exports.AppBskyGraphGetList = __importStar(require("./types/app/bsky/graph/getList.js"));
exports.AppBskyGraphGetListBlocks = __importStar(require("./types/app/bsky/graph/getListBlocks.js"));
exports.AppBskyGraphGetListMutes = __importStar(require("./types/app/bsky/graph/getListMutes.js"));
exports.AppBskyGraphGetLists = __importStar(require("./types/app/bsky/graph/getLists.js"));
exports.AppBskyGraphGetListsWithMembership = __importStar(require("./types/app/bsky/graph/getListsWithMembership.js"));
exports.AppBskyGraphGetMutes = __importStar(require("./types/app/bsky/graph/getMutes.js"));
exports.AppBskyGraphGetRelationships = __importStar(require("./types/app/bsky/graph/getRelationships.js"));
exports.AppBskyGraphGetStarterPack = __importStar(require("./types/app/bsky/graph/getStarterPack.js"));
exports.AppBskyGraphGetStarterPacks = __importStar(require("./types/app/bsky/graph/getStarterPacks.js"));
exports.AppBskyGraphGetStarterPacksWithMembership = __importStar(require("./types/app/bsky/graph/getStarterPacksWithMembership.js"));
exports.AppBskyGraphGetSuggestedFollowsByActor = __importStar(require("./types/app/bsky/graph/getSuggestedFollowsByActor.js"));
exports.AppBskyGraphList = __importStar(require("./types/app/bsky/graph/list.js"));
exports.AppBskyGraphListblock = __importStar(require("./types/app/bsky/graph/listblock.js"));
exports.AppBskyGraphListitem = __importStar(require("./types/app/bsky/graph/listitem.js"));
exports.AppBskyGraphMuteActor = __importStar(require("./types/app/bsky/graph/muteActor.js"));
exports.AppBskyGraphMuteActorList = __importStar(require("./types/app/bsky/graph/muteActorList.js"));
exports.AppBskyGraphMuteThread = __importStar(require("./types/app/bsky/graph/muteThread.js"));
exports.AppBskyGraphSearchStarterPacks = __importStar(require("./types/app/bsky/graph/searchStarterPacks.js"));
exports.AppBskyGraphStarterpack = __importStar(require("./types/app/bsky/graph/starterpack.js"));
exports.AppBskyGraphUnmuteActor = __importStar(require("./types/app/bsky/graph/unmuteActor.js"));
exports.AppBskyGraphUnmuteActorList = __importStar(require("./types/app/bsky/graph/unmuteActorList.js"));
exports.AppBskyGraphUnmuteThread = __importStar(require("./types/app/bsky/graph/unmuteThread.js"));
exports.AppBskyGraphVerification = __importStar(require("./types/app/bsky/graph/verification.js"));
exports.AppBskyLabelerDefs = __importStar(require("./types/app/bsky/labeler/defs.js"));
exports.AppBskyLabelerGetServices = __importStar(require("./types/app/bsky/labeler/getServices.js"));
exports.AppBskyLabelerService = __importStar(require("./types/app/bsky/labeler/service.js"));
exports.AppBskyNotificationDeclaration = __importStar(require("./types/app/bsky/notification/declaration.js"));
exports.AppBskyNotificationDefs = __importStar(require("./types/app/bsky/notification/defs.js"));
exports.AppBskyNotificationGetPreferences = __importStar(require("./types/app/bsky/notification/getPreferences.js"));
exports.AppBskyNotificationGetUnreadCount = __importStar(require("./types/app/bsky/notification/getUnreadCount.js"));
exports.AppBskyNotificationListActivitySubscriptions = __importStar(require("./types/app/bsky/notification/listActivitySubscriptions.js"));
exports.AppBskyNotificationListNotifications = __importStar(require("./types/app/bsky/notification/listNotifications.js"));
exports.AppBskyNotificationPutActivitySubscription = __importStar(require("./types/app/bsky/notification/putActivitySubscription.js"));
exports.AppBskyNotificationPutPreferences = __importStar(require("./types/app/bsky/notification/putPreferences.js"));
exports.AppBskyNotificationPutPreferencesV2 = __importStar(require("./types/app/bsky/notification/putPreferencesV2.js"));
exports.AppBskyNotificationRegisterPush = __importStar(require("./types/app/bsky/notification/registerPush.js"));
exports.AppBskyNotificationUnregisterPush = __importStar(require("./types/app/bsky/notification/unregisterPush.js"));
exports.AppBskyNotificationUpdateSeen = __importStar(require("./types/app/bsky/notification/updateSeen.js"));
exports.AppBskyRichtextFacet = __importStar(require("./types/app/bsky/richtext/facet.js"));
exports.AppBskyUnspeccedDefs = __importStar(require("./types/app/bsky/unspecced/defs.js"));
exports.AppBskyUnspeccedGetAgeAssuranceState = __importStar(require("./types/app/bsky/unspecced/getAgeAssuranceState.js"));
exports.AppBskyUnspeccedGetConfig = __importStar(require("./types/app/bsky/unspecced/getConfig.js"));
exports.AppBskyUnspeccedGetOnboardingSuggestedStarterPacks = __importStar(require("./types/app/bsky/unspecced/getOnboardingSuggestedStarterPacks.js"));
exports.AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton = __importStar(require("./types/app/bsky/unspecced/getOnboardingSuggestedStarterPacksSkeleton.js"));
exports.AppBskyUnspeccedGetPopularFeedGenerators = __importStar(require("./types/app/bsky/unspecced/getPopularFeedGenerators.js"));
exports.AppBskyUnspeccedGetPostThreadOtherV2 = __importStar(require("./types/app/bsky/unspecced/getPostThreadOtherV2.js"));
exports.AppBskyUnspeccedGetPostThreadV2 = __importStar(require("./types/app/bsky/unspecced/getPostThreadV2.js"));
exports.AppBskyUnspeccedGetSuggestedFeeds = __importStar(require("./types/app/bsky/unspecced/getSuggestedFeeds.js"));
exports.AppBskyUnspeccedGetSuggestedFeedsSkeleton = __importStar(require("./types/app/bsky/unspecced/getSuggestedFeedsSkeleton.js"));
exports.AppBskyUnspeccedGetSuggestedStarterPacks = __importStar(require("./types/app/bsky/unspecced/getSuggestedStarterPacks.js"));
exports.AppBskyUnspeccedGetSuggestedStarterPacksSkeleton = __importStar(require("./types/app/bsky/unspecced/getSuggestedStarterPacksSkeleton.js"));
exports.AppBskyUnspeccedGetSuggestedUsers = __importStar(require("./types/app/bsky/unspecced/getSuggestedUsers.js"));
exports.AppBskyUnspeccedGetSuggestedUsersSkeleton = __importStar(require("./types/app/bsky/unspecced/getSuggestedUsersSkeleton.js"));
exports.AppBskyUnspeccedGetSuggestionsSkeleton = __importStar(require("./types/app/bsky/unspecced/getSuggestionsSkeleton.js"));
exports.AppBskyUnspeccedGetTaggedSuggestions = __importStar(require("./types/app/bsky/unspecced/getTaggedSuggestions.js"));
exports.AppBskyUnspeccedGetTrendingTopics = __importStar(require("./types/app/bsky/unspecced/getTrendingTopics.js"));
exports.AppBskyUnspeccedGetTrends = __importStar(require("./types/app/bsky/unspecced/getTrends.js"));
exports.AppBskyUnspeccedGetTrendsSkeleton = __importStar(require("./types/app/bsky/unspecced/getTrendsSkeleton.js"));
exports.AppBskyUnspeccedInitAgeAssurance = __importStar(require("./types/app/bsky/unspecced/initAgeAssurance.js"));
exports.AppBskyUnspeccedSearchActorsSkeleton = __importStar(require("./types/app/bsky/unspecced/searchActorsSkeleton.js"));
exports.AppBskyUnspeccedSearchPostsSkeleton = __importStar(require("./types/app/bsky/unspecced/searchPostsSkeleton.js"));
exports.AppBskyUnspeccedSearchStarterPacksSkeleton = __importStar(require("./types/app/bsky/unspecced/searchStarterPacksSkeleton.js"));
exports.AppBskyVideoDefs = __importStar(require("./types/app/bsky/video/defs.js"));
exports.AppBskyVideoGetJobStatus = __importStar(require("./types/app/bsky/video/getJobStatus.js"));
exports.AppBskyVideoGetUploadLimits = __importStar(require("./types/app/bsky/video/getUploadLimits.js"));
exports.AppBskyVideoUploadVideo = __importStar(require("./types/app/bsky/video/uploadVideo.js"));
exports.ChatBskyActorDeclaration = __importStar(require("./types/chat/bsky/actor/declaration.js"));
exports.ChatBskyActorDefs = __importStar(require("./types/chat/bsky/actor/defs.js"));
exports.ChatBskyActorDeleteAccount = __importStar(require("./types/chat/bsky/actor/deleteAccount.js"));
exports.ChatBskyActorExportAccountData = __importStar(require("./types/chat/bsky/actor/exportAccountData.js"));
exports.ChatBskyConvoAcceptConvo = __importStar(require("./types/chat/bsky/convo/acceptConvo.js"));
exports.ChatBskyConvoAddReaction = __importStar(require("./types/chat/bsky/convo/addReaction.js"));
exports.ChatBskyConvoDefs = __importStar(require("./types/chat/bsky/convo/defs.js"));
exports.ChatBskyConvoDeleteMessageForSelf = __importStar(require("./types/chat/bsky/convo/deleteMessageForSelf.js"));
exports.ChatBskyConvoGetConvo = __importStar(require("./types/chat/bsky/convo/getConvo.js"));
exports.ChatBskyConvoGetConvoAvailability = __importStar(require("./types/chat/bsky/convo/getConvoAvailability.js"));
exports.ChatBskyConvoGetConvoForMembers = __importStar(require("./types/chat/bsky/convo/getConvoForMembers.js"));
exports.ChatBskyConvoGetLog = __importStar(require("./types/chat/bsky/convo/getLog.js"));
exports.ChatBskyConvoGetMessages = __importStar(require("./types/chat/bsky/convo/getMessages.js"));
exports.ChatBskyConvoLeaveConvo = __importStar(require("./types/chat/bsky/convo/leaveConvo.js"));
exports.ChatBskyConvoListConvos = __importStar(require("./types/chat/bsky/convo/listConvos.js"));
exports.ChatBskyConvoMuteConvo = __importStar(require("./types/chat/bsky/convo/muteConvo.js"));
exports.ChatBskyConvoRemoveReaction = __importStar(require("./types/chat/bsky/convo/removeReaction.js"));
exports.ChatBskyConvoSendMessage = __importStar(require("./types/chat/bsky/convo/sendMessage.js"));
exports.ChatBskyConvoSendMessageBatch = __importStar(require("./types/chat/bsky/convo/sendMessageBatch.js"));
exports.ChatBskyConvoUnmuteConvo = __importStar(require("./types/chat/bsky/convo/unmuteConvo.js"));
exports.ChatBskyConvoUpdateAllRead = __importStar(require("./types/chat/bsky/convo/updateAllRead.js"));
exports.ChatBskyConvoUpdateRead = __importStar(require("./types/chat/bsky/convo/updateRead.js"));
exports.ChatBskyModerationGetActorMetadata = __importStar(require("./types/chat/bsky/moderation/getActorMetadata.js"));
exports.ChatBskyModerationGetMessageContext = __importStar(require("./types/chat/bsky/moderation/getMessageContext.js"));
exports.ChatBskyModerationUpdateActorAccess = __importStar(require("./types/chat/bsky/moderation/updateActorAccess.js"));
exports.ComAtprotoAdminDefs = __importStar(require("./types/com/atproto/admin/defs.js"));
exports.ComAtprotoAdminDeleteAccount = __importStar(require("./types/com/atproto/admin/deleteAccount.js"));
exports.ComAtprotoAdminDisableAccountInvites = __importStar(require("./types/com/atproto/admin/disableAccountInvites.js"));
exports.ComAtprotoAdminDisableInviteCodes = __importStar(require("./types/com/atproto/admin/disableInviteCodes.js"));
exports.ComAtprotoAdminEnableAccountInvites = __importStar(require("./types/com/atproto/admin/enableAccountInvites.js"));
exports.ComAtprotoAdminGetAccountInfo = __importStar(require("./types/com/atproto/admin/getAccountInfo.js"));
exports.ComAtprotoAdminGetAccountInfos = __importStar(require("./types/com/atproto/admin/getAccountInfos.js"));
exports.ComAtprotoAdminGetInviteCodes = __importStar(require("./types/com/atproto/admin/getInviteCodes.js"));
exports.ComAtprotoAdminGetSubjectStatus = __importStar(require("./types/com/atproto/admin/getSubjectStatus.js"));
exports.ComAtprotoAdminSearchAccounts = __importStar(require("./types/com/atproto/admin/searchAccounts.js"));
exports.ComAtprotoAdminSendEmail = __importStar(require("./types/com/atproto/admin/sendEmail.js"));
exports.ComAtprotoAdminUpdateAccountEmail = __importStar(require("./types/com/atproto/admin/updateAccountEmail.js"));
exports.ComAtprotoAdminUpdateAccountHandle = __importStar(require("./types/com/atproto/admin/updateAccountHandle.js"));
exports.ComAtprotoAdminUpdateAccountPassword = __importStar(require("./types/com/atproto/admin/updateAccountPassword.js"));
exports.ComAtprotoAdminUpdateAccountSigningKey = __importStar(require("./types/com/atproto/admin/updateAccountSigningKey.js"));
exports.ComAtprotoAdminUpdateSubjectStatus = __importStar(require("./types/com/atproto/admin/updateSubjectStatus.js"));
exports.ComAtprotoIdentityDefs = __importStar(require("./types/com/atproto/identity/defs.js"));
exports.ComAtprotoIdentityGetRecommendedDidCredentials = __importStar(require("./types/com/atproto/identity/getRecommendedDidCredentials.js"));
exports.ComAtprotoIdentityRefreshIdentity = __importStar(require("./types/com/atproto/identity/refreshIdentity.js"));
exports.ComAtprotoIdentityRequestPlcOperationSignature = __importStar(require("./types/com/atproto/identity/requestPlcOperationSignature.js"));
exports.ComAtprotoIdentityResolveDid = __importStar(require("./types/com/atproto/identity/resolveDid.js"));
exports.ComAtprotoIdentityResolveHandle = __importStar(require("./types/com/atproto/identity/resolveHandle.js"));
exports.ComAtprotoIdentityResolveIdentity = __importStar(require("./types/com/atproto/identity/resolveIdentity.js"));
exports.ComAtprotoIdentitySignPlcOperation = __importStar(require("./types/com/atproto/identity/signPlcOperation.js"));
exports.ComAtprotoIdentitySubmitPlcOperation = __importStar(require("./types/com/atproto/identity/submitPlcOperation.js"));
exports.ComAtprotoIdentityUpdateHandle = __importStar(require("./types/com/atproto/identity/updateHandle.js"));
exports.ComAtprotoLabelDefs = __importStar(require("./types/com/atproto/label/defs.js"));
exports.ComAtprotoLabelQueryLabels = __importStar(require("./types/com/atproto/label/queryLabels.js"));
exports.ComAtprotoLabelSubscribeLabels = __importStar(require("./types/com/atproto/label/subscribeLabels.js"));
exports.ComAtprotoLexiconResolveLexicon = __importStar(require("./types/com/atproto/lexicon/resolveLexicon.js"));
exports.ComAtprotoLexiconSchema = __importStar(require("./types/com/atproto/lexicon/schema.js"));
exports.ComAtprotoModerationCreateReport = __importStar(require("./types/com/atproto/moderation/createReport.js"));
exports.ComAtprotoModerationDefs = __importStar(require("./types/com/atproto/moderation/defs.js"));
exports.ComAtprotoRepoApplyWrites = __importStar(require("./types/com/atproto/repo/applyWrites.js"));
exports.ComAtprotoRepoCreateRecord = __importStar(require("./types/com/atproto/repo/createRecord.js"));
exports.ComAtprotoRepoDefs = __importStar(require("./types/com/atproto/repo/defs.js"));
exports.ComAtprotoRepoDeleteRecord = __importStar(require("./types/com/atproto/repo/deleteRecord.js"));
exports.ComAtprotoRepoDescribeRepo = __importStar(require("./types/com/atproto/repo/describeRepo.js"));
exports.ComAtprotoRepoGetRecord = __importStar(require("./types/com/atproto/repo/getRecord.js"));
exports.ComAtprotoRepoImportRepo = __importStar(require("./types/com/atproto/repo/importRepo.js"));
exports.ComAtprotoRepoListMissingBlobs = __importStar(require("./types/com/atproto/repo/listMissingBlobs.js"));
exports.ComAtprotoRepoListRecords = __importStar(require("./types/com/atproto/repo/listRecords.js"));
exports.ComAtprotoRepoPutRecord = __importStar(require("./types/com/atproto/repo/putRecord.js"));
exports.ComAtprotoRepoStrongRef = __importStar(require("./types/com/atproto/repo/strongRef.js"));
exports.ComAtprotoRepoUploadBlob = __importStar(require("./types/com/atproto/repo/uploadBlob.js"));
exports.ComAtprotoServerActivateAccount = __importStar(require("./types/com/atproto/server/activateAccount.js"));
exports.ComAtprotoServerCheckAccountStatus = __importStar(require("./types/com/atproto/server/checkAccountStatus.js"));
exports.ComAtprotoServerConfirmEmail = __importStar(require("./types/com/atproto/server/confirmEmail.js"));
exports.ComAtprotoServerCreateAccount = __importStar(require("./types/com/atproto/server/createAccount.js"));
exports.ComAtprotoServerCreateAppPassword = __importStar(require("./types/com/atproto/server/createAppPassword.js"));
exports.ComAtprotoServerCreateInviteCode = __importStar(require("./types/com/atproto/server/createInviteCode.js"));
exports.ComAtprotoServerCreateInviteCodes = __importStar(require("./types/com/atproto/server/createInviteCodes.js"));
exports.ComAtprotoServerCreateSession = __importStar(require("./types/com/atproto/server/createSession.js"));
exports.ComAtprotoServerDeactivateAccount = __importStar(require("./types/com/atproto/server/deactivateAccount.js"));
exports.ComAtprotoServerDefs = __importStar(require("./types/com/atproto/server/defs.js"));
exports.ComAtprotoServerDeleteAccount = __importStar(require("./types/com/atproto/server/deleteAccount.js"));
exports.ComAtprotoServerDeleteSession = __importStar(require("./types/com/atproto/server/deleteSession.js"));
exports.ComAtprotoServerDescribeServer = __importStar(require("./types/com/atproto/server/describeServer.js"));
exports.ComAtprotoServerGetAccountInviteCodes = __importStar(require("./types/com/atproto/server/getAccountInviteCodes.js"));
exports.ComAtprotoServerGetServiceAuth = __importStar(require("./types/com/atproto/server/getServiceAuth.js"));
exports.ComAtprotoServerGetSession = __importStar(require("./types/com/atproto/server/getSession.js"));
exports.ComAtprotoServerListAppPasswords = __importStar(require("./types/com/atproto/server/listAppPasswords.js"));
exports.ComAtprotoServerRefreshSession = __importStar(require("./types/com/atproto/server/refreshSession.js"));
exports.ComAtprotoServerRequestAccountDelete = __importStar(require("./types/com/atproto/server/requestAccountDelete.js"));
exports.ComAtprotoServerRequestEmailConfirmation = __importStar(require("./types/com/atproto/server/requestEmailConfirmation.js"));
exports.ComAtprotoServerRequestEmailUpdate = __importStar(require("./types/com/atproto/server/requestEmailUpdate.js"));
exports.ComAtprotoServerRequestPasswordReset = __importStar(require("./types/com/atproto/server/requestPasswordReset.js"));
exports.ComAtprotoServerReserveSigningKey = __importStar(require("./types/com/atproto/server/reserveSigningKey.js"));
exports.ComAtprotoServerResetPassword = __importStar(require("./types/com/atproto/server/resetPassword.js"));
exports.ComAtprotoServerRevokeAppPassword = __importStar(require("./types/com/atproto/server/revokeAppPassword.js"));
exports.ComAtprotoServerUpdateEmail = __importStar(require("./types/com/atproto/server/updateEmail.js"));
exports.ComAtprotoSyncDefs = __importStar(require("./types/com/atproto/sync/defs.js"));
exports.ComAtprotoSyncGetBlob = __importStar(require("./types/com/atproto/sync/getBlob.js"));
exports.ComAtprotoSyncGetBlocks = __importStar(require("./types/com/atproto/sync/getBlocks.js"));
exports.ComAtprotoSyncGetCheckout = __importStar(require("./types/com/atproto/sync/getCheckout.js"));
exports.ComAtprotoSyncGetHead = __importStar(require("./types/com/atproto/sync/getHead.js"));
exports.ComAtprotoSyncGetHostStatus = __importStar(require("./types/com/atproto/sync/getHostStatus.js"));
exports.ComAtprotoSyncGetLatestCommit = __importStar(require("./types/com/atproto/sync/getLatestCommit.js"));
exports.ComAtprotoSyncGetRecord = __importStar(require("./types/com/atproto/sync/getRecord.js"));
exports.ComAtprotoSyncGetRepo = __importStar(require("./types/com/atproto/sync/getRepo.js"));
exports.ComAtprotoSyncGetRepoStatus = __importStar(require("./types/com/atproto/sync/getRepoStatus.js"));
exports.ComAtprotoSyncListBlobs = __importStar(require("./types/com/atproto/sync/listBlobs.js"));
exports.ComAtprotoSyncListHosts = __importStar(require("./types/com/atproto/sync/listHosts.js"));
exports.ComAtprotoSyncListRepos = __importStar(require("./types/com/atproto/sync/listRepos.js"));
exports.ComAtprotoSyncListReposByCollection = __importStar(require("./types/com/atproto/sync/listReposByCollection.js"));
exports.ComAtprotoSyncNotifyOfUpdate = __importStar(require("./types/com/atproto/sync/notifyOfUpdate.js"));
exports.ComAtprotoSyncRequestCrawl = __importStar(require("./types/com/atproto/sync/requestCrawl.js"));
exports.ComAtprotoSyncSubscribeRepos = __importStar(require("./types/com/atproto/sync/subscribeRepos.js"));
exports.ComAtprotoTempAddReservedHandle = __importStar(require("./types/com/atproto/temp/addReservedHandle.js"));
exports.ComAtprotoTempCheckHandleAvailability = __importStar(require("./types/com/atproto/temp/checkHandleAvailability.js"));
exports.ComAtprotoTempCheckSignupQueue = __importStar(require("./types/com/atproto/temp/checkSignupQueue.js"));
exports.ComAtprotoTempDereferenceScope = __importStar(require("./types/com/atproto/temp/dereferenceScope.js"));
exports.ComAtprotoTempFetchLabels = __importStar(require("./types/com/atproto/temp/fetchLabels.js"));
exports.ComAtprotoTempRequestPhoneVerification = __importStar(require("./types/com/atproto/temp/requestPhoneVerification.js"));
exports.ComAtprotoTempRevokeAccountCredentials = __importStar(require("./types/com/atproto/temp/revokeAccountCredentials.js"));
exports.ToolsOzoneCommunicationCreateTemplate = __importStar(require("./types/tools/ozone/communication/createTemplate.js"));
exports.ToolsOzoneCommunicationDefs = __importStar(require("./types/tools/ozone/communication/defs.js"));
exports.ToolsOzoneCommunicationDeleteTemplate = __importStar(require("./types/tools/ozone/communication/deleteTemplate.js"));
exports.ToolsOzoneCommunicationListTemplates = __importStar(require("./types/tools/ozone/communication/listTemplates.js"));
exports.ToolsOzoneCommunicationUpdateTemplate = __importStar(require("./types/tools/ozone/communication/updateTemplate.js"));
exports.ToolsOzoneHostingGetAccountHistory = __importStar(require("./types/tools/ozone/hosting/getAccountHistory.js"));
exports.ToolsOzoneModerationCancelScheduledActions = __importStar(require("./types/tools/ozone/moderation/cancelScheduledActions.js"));
exports.ToolsOzoneModerationDefs = __importStar(require("./types/tools/ozone/moderation/defs.js"));
exports.ToolsOzoneModerationEmitEvent = __importStar(require("./types/tools/ozone/moderation/emitEvent.js"));
exports.ToolsOzoneModerationGetAccountTimeline = __importStar(require("./types/tools/ozone/moderation/getAccountTimeline.js"));
exports.ToolsOzoneModerationGetEvent = __importStar(require("./types/tools/ozone/moderation/getEvent.js"));
exports.ToolsOzoneModerationGetRecord = __importStar(require("./types/tools/ozone/moderation/getRecord.js"));
exports.ToolsOzoneModerationGetRecords = __importStar(require("./types/tools/ozone/moderation/getRecords.js"));
exports.ToolsOzoneModerationGetRepo = __importStar(require("./types/tools/ozone/moderation/getRepo.js"));
exports.ToolsOzoneModerationGetReporterStats = __importStar(require("./types/tools/ozone/moderation/getReporterStats.js"));
exports.ToolsOzoneModerationGetRepos = __importStar(require("./types/tools/ozone/moderation/getRepos.js"));
exports.ToolsOzoneModerationGetSubjects = __importStar(require("./types/tools/ozone/moderation/getSubjects.js"));
exports.ToolsOzoneModerationListScheduledActions = __importStar(require("./types/tools/ozone/moderation/listScheduledActions.js"));
exports.ToolsOzoneModerationQueryEvents = __importStar(require("./types/tools/ozone/moderation/queryEvents.js"));
exports.ToolsOzoneModerationQueryStatuses = __importStar(require("./types/tools/ozone/moderation/queryStatuses.js"));
exports.ToolsOzoneModerationScheduleAction = __importStar(require("./types/tools/ozone/moderation/scheduleAction.js"));
exports.ToolsOzoneModerationSearchRepos = __importStar(require("./types/tools/ozone/moderation/searchRepos.js"));
exports.ToolsOzoneReportDefs = __importStar(require("./types/tools/ozone/report/defs.js"));
exports.ToolsOzoneSafelinkAddRule = __importStar(require("./types/tools/ozone/safelink/addRule.js"));
exports.ToolsOzoneSafelinkDefs = __importStar(require("./types/tools/ozone/safelink/defs.js"));
exports.ToolsOzoneSafelinkQueryEvents = __importStar(require("./types/tools/ozone/safelink/queryEvents.js"));
exports.ToolsOzoneSafelinkQueryRules = __importStar(require("./types/tools/ozone/safelink/queryRules.js"));
exports.ToolsOzoneSafelinkRemoveRule = __importStar(require("./types/tools/ozone/safelink/removeRule.js"));
exports.ToolsOzoneSafelinkUpdateRule = __importStar(require("./types/tools/ozone/safelink/updateRule.js"));
exports.ToolsOzoneServerGetConfig = __importStar(require("./types/tools/ozone/server/getConfig.js"));
exports.ToolsOzoneSetAddValues = __importStar(require("./types/tools/ozone/set/addValues.js"));
exports.ToolsOzoneSetDefs = __importStar(require("./types/tools/ozone/set/defs.js"));
exports.ToolsOzoneSetDeleteSet = __importStar(require("./types/tools/ozone/set/deleteSet.js"));
exports.ToolsOzoneSetDeleteValues = __importStar(require("./types/tools/ozone/set/deleteValues.js"));
exports.ToolsOzoneSetGetValues = __importStar(require("./types/tools/ozone/set/getValues.js"));
exports.ToolsOzoneSetQuerySets = __importStar(require("./types/tools/ozone/set/querySets.js"));
exports.ToolsOzoneSetUpsertSet = __importStar(require("./types/tools/ozone/set/upsertSet.js"));
exports.ToolsOzoneSettingDefs = __importStar(require("./types/tools/ozone/setting/defs.js"));
exports.ToolsOzoneSettingListOptions = __importStar(require("./types/tools/ozone/setting/listOptions.js"));
exports.ToolsOzoneSettingRemoveOptions = __importStar(require("./types/tools/ozone/setting/removeOptions.js"));
exports.ToolsOzoneSettingUpsertOption = __importStar(require("./types/tools/ozone/setting/upsertOption.js"));
exports.ToolsOzoneSignatureDefs = __importStar(require("./types/tools/ozone/signature/defs.js"));
exports.ToolsOzoneSignatureFindCorrelation = __importStar(require("./types/tools/ozone/signature/findCorrelation.js"));
exports.ToolsOzoneSignatureFindRelatedAccounts = __importStar(require("./types/tools/ozone/signature/findRelatedAccounts.js"));
exports.ToolsOzoneSignatureSearchAccounts = __importStar(require("./types/tools/ozone/signature/searchAccounts.js"));
exports.ToolsOzoneTeamAddMember = __importStar(require("./types/tools/ozone/team/addMember.js"));
exports.ToolsOzoneTeamDefs = __importStar(require("./types/tools/ozone/team/defs.js"));
exports.ToolsOzoneTeamDeleteMember = __importStar(require("./types/tools/ozone/team/deleteMember.js"));
exports.ToolsOzoneTeamListMembers = __importStar(require("./types/tools/ozone/team/listMembers.js"));
exports.ToolsOzoneTeamUpdateMember = __importStar(require("./types/tools/ozone/team/updateMember.js"));
exports.ToolsOzoneVerificationDefs = __importStar(require("./types/tools/ozone/verification/defs.js"));
exports.ToolsOzoneVerificationGrantVerifications = __importStar(require("./types/tools/ozone/verification/grantVerifications.js"));
exports.ToolsOzoneVerificationListVerifications = __importStar(require("./types/tools/ozone/verification/listVerifications.js"));
exports.ToolsOzoneVerificationRevokeVerifications = __importStar(require("./types/tools/ozone/verification/revokeVerifications.js"));
exports.APP_BSKY_ACTOR = {
    StatusLive: 'app.bsky.actor.status#live',
};
exports.APP_BSKY_FEED = {
    DefsRequestLess: 'app.bsky.feed.defs#requestLess',
    DefsRequestMore: 'app.bsky.feed.defs#requestMore',
    DefsClickthroughItem: 'app.bsky.feed.defs#clickthroughItem',
    DefsClickthroughAuthor: 'app.bsky.feed.defs#clickthroughAuthor',
    DefsClickthroughReposter: 'app.bsky.feed.defs#clickthroughReposter',
    DefsClickthroughEmbed: 'app.bsky.feed.defs#clickthroughEmbed',
    DefsContentModeUnspecified: 'app.bsky.feed.defs#contentModeUnspecified',
    DefsContentModeVideo: 'app.bsky.feed.defs#contentModeVideo',
    DefsInteractionSeen: 'app.bsky.feed.defs#interactionSeen',
    DefsInteractionLike: 'app.bsky.feed.defs#interactionLike',
    DefsInteractionRepost: 'app.bsky.feed.defs#interactionRepost',
    DefsInteractionReply: 'app.bsky.feed.defs#interactionReply',
    DefsInteractionQuote: 'app.bsky.feed.defs#interactionQuote',
    DefsInteractionShare: 'app.bsky.feed.defs#interactionShare',
};
exports.APP_BSKY_GRAPH = {
    DefsModlist: 'app.bsky.graph.defs#modlist',
    DefsCuratelist: 'app.bsky.graph.defs#curatelist',
    DefsReferencelist: 'app.bsky.graph.defs#referencelist',
};
exports.COM_ATPROTO_MODERATION = {
    DefsReasonSpam: 'com.atproto.moderation.defs#reasonSpam',
    DefsReasonViolation: 'com.atproto.moderation.defs#reasonViolation',
    DefsReasonMisleading: 'com.atproto.moderation.defs#reasonMisleading',
    DefsReasonSexual: 'com.atproto.moderation.defs#reasonSexual',
    DefsReasonRude: 'com.atproto.moderation.defs#reasonRude',
    DefsReasonOther: 'com.atproto.moderation.defs#reasonOther',
    DefsReasonAppeal: 'com.atproto.moderation.defs#reasonAppeal',
};
exports.TOOLS_OZONE_MODERATION = {
    DefsReviewOpen: 'tools.ozone.moderation.defs#reviewOpen',
    DefsReviewEscalated: 'tools.ozone.moderation.defs#reviewEscalated',
    DefsReviewClosed: 'tools.ozone.moderation.defs#reviewClosed',
    DefsReviewNone: 'tools.ozone.moderation.defs#reviewNone',
    DefsTimelineEventPlcCreate: 'tools.ozone.moderation.defs#timelineEventPlcCreate',
    DefsTimelineEventPlcOperation: 'tools.ozone.moderation.defs#timelineEventPlcOperation',
    DefsTimelineEventPlcTombstone: 'tools.ozone.moderation.defs#timelineEventPlcTombstone',
};
exports.TOOLS_OZONE_REPORT = {
    DefsReasonAppeal: 'tools.ozone.report.defs#reasonAppeal',
    DefsReasonOther: 'tools.ozone.report.defs#reasonOther',
    DefsReasonViolenceAnimal: 'tools.ozone.report.defs#reasonViolenceAnimal',
    DefsReasonViolenceThreats: 'tools.ozone.report.defs#reasonViolenceThreats',
    DefsReasonViolenceGraphicContent: 'tools.ozone.report.defs#reasonViolenceGraphicContent',
    DefsReasonViolenceGlorification: 'tools.ozone.report.defs#reasonViolenceGlorification',
    DefsReasonViolenceExtremistContent: 'tools.ozone.report.defs#reasonViolenceExtremistContent',
    DefsReasonViolenceTrafficking: 'tools.ozone.report.defs#reasonViolenceTrafficking',
    DefsReasonViolenceOther: 'tools.ozone.report.defs#reasonViolenceOther',
    DefsReasonSexualAbuseContent: 'tools.ozone.report.defs#reasonSexualAbuseContent',
    DefsReasonSexualNCII: 'tools.ozone.report.defs#reasonSexualNCII',
    DefsReasonSexualDeepfake: 'tools.ozone.report.defs#reasonSexualDeepfake',
    DefsReasonSexualAnimal: 'tools.ozone.report.defs#reasonSexualAnimal',
    DefsReasonSexualUnlabeled: 'tools.ozone.report.defs#reasonSexualUnlabeled',
    DefsReasonSexualOther: 'tools.ozone.report.defs#reasonSexualOther',
    DefsReasonChildSafetyCSAM: 'tools.ozone.report.defs#reasonChildSafetyCSAM',
    DefsReasonChildSafetyGroom: 'tools.ozone.report.defs#reasonChildSafetyGroom',
    DefsReasonChildSafetyPrivacy: 'tools.ozone.report.defs#reasonChildSafetyPrivacy',
    DefsReasonChildSafetyHarassment: 'tools.ozone.report.defs#reasonChildSafetyHarassment',
    DefsReasonChildSafetyOther: 'tools.ozone.report.defs#reasonChildSafetyOther',
    DefsReasonHarassmentTroll: 'tools.ozone.report.defs#reasonHarassmentTroll',
    DefsReasonHarassmentTargeted: 'tools.ozone.report.defs#reasonHarassmentTargeted',
    DefsReasonHarassmentHateSpeech: 'tools.ozone.report.defs#reasonHarassmentHateSpeech',
    DefsReasonHarassmentDoxxing: 'tools.ozone.report.defs#reasonHarassmentDoxxing',
    DefsReasonHarassmentOther: 'tools.ozone.report.defs#reasonHarassmentOther',
    DefsReasonMisleadingBot: 'tools.ozone.report.defs#reasonMisleadingBot',
    DefsReasonMisleadingImpersonation: 'tools.ozone.report.defs#reasonMisleadingImpersonation',
    DefsReasonMisleadingSpam: 'tools.ozone.report.defs#reasonMisleadingSpam',
    DefsReasonMisleadingScam: 'tools.ozone.report.defs#reasonMisleadingScam',
    DefsReasonMisleadingElections: 'tools.ozone.report.defs#reasonMisleadingElections',
    DefsReasonMisleadingOther: 'tools.ozone.report.defs#reasonMisleadingOther',
    DefsReasonRuleSiteSecurity: 'tools.ozone.report.defs#reasonRuleSiteSecurity',
    DefsReasonRuleProhibitedSales: 'tools.ozone.report.defs#reasonRuleProhibitedSales',
    DefsReasonRuleBanEvasion: 'tools.ozone.report.defs#reasonRuleBanEvasion',
    DefsReasonRuleOther: 'tools.ozone.report.defs#reasonRuleOther',
    DefsReasonSelfHarmContent: 'tools.ozone.report.defs#reasonSelfHarmContent',
    DefsReasonSelfHarmED: 'tools.ozone.report.defs#reasonSelfHarmED',
    DefsReasonSelfHarmStunts: 'tools.ozone.report.defs#reasonSelfHarmStunts',
    DefsReasonSelfHarmSubstances: 'tools.ozone.report.defs#reasonSelfHarmSubstances',
    DefsReasonSelfHarmOther: 'tools.ozone.report.defs#reasonSelfHarmOther',
};
exports.TOOLS_OZONE_TEAM = {
    DefsRoleAdmin: 'tools.ozone.team.defs#roleAdmin',
    DefsRoleModerator: 'tools.ozone.team.defs#roleModerator',
    DefsRoleTriage: 'tools.ozone.team.defs#roleTriage',
    DefsRoleVerifier: 'tools.ozone.team.defs#roleVerifier',
};
class AtpBaseClient extends xrpc_1.XrpcClient {
    constructor(options) {
        super(options, lexicons_js_1.schemas);
        Object.defineProperty(this, "app", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "chat", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "com", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tools", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.app = new AppNS(this);
        this.chat = new ChatNS(this);
        this.com = new ComNS(this);
        this.tools = new ToolsNS(this);
    }
    /** @deprecated use `this` instead */
    get xrpc() {
        return this;
    }
}
exports.AtpBaseClient = AtpBaseClient;
class AppNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bsky", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.bsky = new AppBskyNS(client);
    }
}
exports.AppNS = AppNS;
class AppBskyNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "actor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ageassurance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bookmark", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "contact", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "embed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "feed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "graph", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "labeler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "notification", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "richtext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "unspecced", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "video", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.actor = new AppBskyActorNS(client);
        this.ageassurance = new AppBskyAgeassuranceNS(client);
        this.bookmark = new AppBskyBookmarkNS(client);
        this.contact = new AppBskyContactNS(client);
        this.embed = new AppBskyEmbedNS(client);
        this.feed = new AppBskyFeedNS(client);
        this.graph = new AppBskyGraphNS(client);
        this.labeler = new AppBskyLabelerNS(client);
        this.notification = new AppBskyNotificationNS(client);
        this.richtext = new AppBskyRichtextNS(client);
        this.unspecced = new AppBskyUnspeccedNS(client);
        this.video = new AppBskyVideoNS(client);
    }
}
exports.AppBskyNS = AppBskyNS;
class AppBskyActorNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "profile", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.profile = new AppBskyActorProfileRecord(client);
        this.status = new AppBskyActorStatusRecord(client);
    }
    getPreferences(params, opts) {
        return this._client.call('app.bsky.actor.getPreferences', params, undefined, opts);
    }
    getProfile(params, opts) {
        return this._client.call('app.bsky.actor.getProfile', params, undefined, opts);
    }
    getProfiles(params, opts) {
        return this._client.call('app.bsky.actor.getProfiles', params, undefined, opts);
    }
    getSuggestions(params, opts) {
        return this._client.call('app.bsky.actor.getSuggestions', params, undefined, opts);
    }
    putPreferences(data, opts) {
        return this._client.call('app.bsky.actor.putPreferences', opts?.qp, data, opts);
    }
    searchActors(params, opts) {
        return this._client.call('app.bsky.actor.searchActors', params, undefined, opts);
    }
    searchActorsTypeahead(params, opts) {
        return this._client.call('app.bsky.actor.searchActorsTypeahead', params, undefined, opts);
    }
}
exports.AppBskyActorNS = AppBskyActorNS;
class AppBskyActorProfileRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.actor.profile',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.actor.profile',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.actor.profile';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, {
            collection,
            rkey: 'self',
            ...params,
            record: { ...record, $type: collection },
        }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.actor.profile';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.actor.profile', ...params }, { headers });
    }
}
exports.AppBskyActorProfileRecord = AppBskyActorProfileRecord;
class AppBskyActorStatusRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.actor.status',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.actor.status',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.actor.status';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, {
            collection,
            rkey: 'self',
            ...params,
            record: { ...record, $type: collection },
        }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.actor.status';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.actor.status', ...params }, { headers });
    }
}
exports.AppBskyActorStatusRecord = AppBskyActorStatusRecord;
class AppBskyAgeassuranceNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    begin(data, opts) {
        return this._client
            .call('app.bsky.ageassurance.begin', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyAgeassuranceBegin.toKnownErr(e);
        });
    }
    getConfig(params, opts) {
        return this._client.call('app.bsky.ageassurance.getConfig', params, undefined, opts);
    }
    getState(params, opts) {
        return this._client.call('app.bsky.ageassurance.getState', params, undefined, opts);
    }
}
exports.AppBskyAgeassuranceNS = AppBskyAgeassuranceNS;
class AppBskyBookmarkNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    createBookmark(data, opts) {
        return this._client
            .call('app.bsky.bookmark.createBookmark', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyBookmarkCreateBookmark.toKnownErr(e);
        });
    }
    deleteBookmark(data, opts) {
        return this._client
            .call('app.bsky.bookmark.deleteBookmark', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyBookmarkDeleteBookmark.toKnownErr(e);
        });
    }
    getBookmarks(params, opts) {
        return this._client.call('app.bsky.bookmark.getBookmarks', params, undefined, opts);
    }
}
exports.AppBskyBookmarkNS = AppBskyBookmarkNS;
class AppBskyContactNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    dismissMatch(data, opts) {
        return this._client
            .call('app.bsky.contact.dismissMatch', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyContactDismissMatch.toKnownErr(e);
        });
    }
    getMatches(params, opts) {
        return this._client
            .call('app.bsky.contact.getMatches', params, undefined, opts)
            .catch((e) => {
            throw AppBskyContactGetMatches.toKnownErr(e);
        });
    }
    getSyncStatus(params, opts) {
        return this._client
            .call('app.bsky.contact.getSyncStatus', params, undefined, opts)
            .catch((e) => {
            throw AppBskyContactGetSyncStatus.toKnownErr(e);
        });
    }
    importContacts(data, opts) {
        return this._client
            .call('app.bsky.contact.importContacts', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyContactImportContacts.toKnownErr(e);
        });
    }
    removeData(data, opts) {
        return this._client
            .call('app.bsky.contact.removeData', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyContactRemoveData.toKnownErr(e);
        });
    }
    sendNotification(data, opts) {
        return this._client.call('app.bsky.contact.sendNotification', opts?.qp, data, opts);
    }
    startPhoneVerification(data, opts) {
        return this._client
            .call('app.bsky.contact.startPhoneVerification', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyContactStartPhoneVerification.toKnownErr(e);
        });
    }
    verifyPhone(data, opts) {
        return this._client
            .call('app.bsky.contact.verifyPhone', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyContactVerifyPhone.toKnownErr(e);
        });
    }
}
exports.AppBskyContactNS = AppBskyContactNS;
class AppBskyEmbedNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
}
exports.AppBskyEmbedNS = AppBskyEmbedNS;
class AppBskyFeedNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "generator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "like", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "post", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "postgate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "repost", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "threadgate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.generator = new AppBskyFeedGeneratorRecord(client);
        this.like = new AppBskyFeedLikeRecord(client);
        this.post = new AppBskyFeedPostRecord(client);
        this.postgate = new AppBskyFeedPostgateRecord(client);
        this.repost = new AppBskyFeedRepostRecord(client);
        this.threadgate = new AppBskyFeedThreadgateRecord(client);
    }
    describeFeedGenerator(params, opts) {
        return this._client.call('app.bsky.feed.describeFeedGenerator', params, undefined, opts);
    }
    getActorFeeds(params, opts) {
        return this._client.call('app.bsky.feed.getActorFeeds', params, undefined, opts);
    }
    getActorLikes(params, opts) {
        return this._client
            .call('app.bsky.feed.getActorLikes', params, undefined, opts)
            .catch((e) => {
            throw AppBskyFeedGetActorLikes.toKnownErr(e);
        });
    }
    getAuthorFeed(params, opts) {
        return this._client
            .call('app.bsky.feed.getAuthorFeed', params, undefined, opts)
            .catch((e) => {
            throw AppBskyFeedGetAuthorFeed.toKnownErr(e);
        });
    }
    getFeed(params, opts) {
        return this._client
            .call('app.bsky.feed.getFeed', params, undefined, opts)
            .catch((e) => {
            throw AppBskyFeedGetFeed.toKnownErr(e);
        });
    }
    getFeedGenerator(params, opts) {
        return this._client.call('app.bsky.feed.getFeedGenerator', params, undefined, opts);
    }
    getFeedGenerators(params, opts) {
        return this._client.call('app.bsky.feed.getFeedGenerators', params, undefined, opts);
    }
    getFeedSkeleton(params, opts) {
        return this._client
            .call('app.bsky.feed.getFeedSkeleton', params, undefined, opts)
            .catch((e) => {
            throw AppBskyFeedGetFeedSkeleton.toKnownErr(e);
        });
    }
    getLikes(params, opts) {
        return this._client.call('app.bsky.feed.getLikes', params, undefined, opts);
    }
    getListFeed(params, opts) {
        return this._client
            .call('app.bsky.feed.getListFeed', params, undefined, opts)
            .catch((e) => {
            throw AppBskyFeedGetListFeed.toKnownErr(e);
        });
    }
    getPostThread(params, opts) {
        return this._client
            .call('app.bsky.feed.getPostThread', params, undefined, opts)
            .catch((e) => {
            throw AppBskyFeedGetPostThread.toKnownErr(e);
        });
    }
    getPosts(params, opts) {
        return this._client.call('app.bsky.feed.getPosts', params, undefined, opts);
    }
    getQuotes(params, opts) {
        return this._client.call('app.bsky.feed.getQuotes', params, undefined, opts);
    }
    getRepostedBy(params, opts) {
        return this._client.call('app.bsky.feed.getRepostedBy', params, undefined, opts);
    }
    getSuggestedFeeds(params, opts) {
        return this._client.call('app.bsky.feed.getSuggestedFeeds', params, undefined, opts);
    }
    getTimeline(params, opts) {
        return this._client.call('app.bsky.feed.getTimeline', params, undefined, opts);
    }
    searchPosts(params, opts) {
        return this._client
            .call('app.bsky.feed.searchPosts', params, undefined, opts)
            .catch((e) => {
            throw AppBskyFeedSearchPosts.toKnownErr(e);
        });
    }
    sendInteractions(data, opts) {
        return this._client.call('app.bsky.feed.sendInteractions', opts?.qp, data, opts);
    }
}
exports.AppBskyFeedNS = AppBskyFeedNS;
class AppBskyFeedGeneratorRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.feed.generator',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.feed.generator',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.feed.generator';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.feed.generator';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.feed.generator', ...params }, { headers });
    }
}
exports.AppBskyFeedGeneratorRecord = AppBskyFeedGeneratorRecord;
class AppBskyFeedLikeRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.feed.like',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.feed.like',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.feed.like';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.feed.like';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.feed.like', ...params }, { headers });
    }
}
exports.AppBskyFeedLikeRecord = AppBskyFeedLikeRecord;
class AppBskyFeedPostRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.feed.post',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.feed.post',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.feed.post';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.feed.post';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.feed.post', ...params }, { headers });
    }
}
exports.AppBskyFeedPostRecord = AppBskyFeedPostRecord;
class AppBskyFeedPostgateRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.feed.postgate',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.feed.postgate',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.feed.postgate';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.feed.postgate';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.feed.postgate', ...params }, { headers });
    }
}
exports.AppBskyFeedPostgateRecord = AppBskyFeedPostgateRecord;
class AppBskyFeedRepostRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.feed.repost',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.feed.repost',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.feed.repost';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.feed.repost';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.feed.repost', ...params }, { headers });
    }
}
exports.AppBskyFeedRepostRecord = AppBskyFeedRepostRecord;
class AppBskyFeedThreadgateRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.feed.threadgate',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.feed.threadgate',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.feed.threadgate';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.feed.threadgate';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.feed.threadgate', ...params }, { headers });
    }
}
exports.AppBskyFeedThreadgateRecord = AppBskyFeedThreadgateRecord;
class AppBskyGraphNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "block", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "follow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "list", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "listblock", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "listitem", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "starterpack", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "verification", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.block = new AppBskyGraphBlockRecord(client);
        this.follow = new AppBskyGraphFollowRecord(client);
        this.list = new AppBskyGraphListRecord(client);
        this.listblock = new AppBskyGraphListblockRecord(client);
        this.listitem = new AppBskyGraphListitemRecord(client);
        this.starterpack = new AppBskyGraphStarterpackRecord(client);
        this.verification = new AppBskyGraphVerificationRecord(client);
    }
    getActorStarterPacks(params, opts) {
        return this._client.call('app.bsky.graph.getActorStarterPacks', params, undefined, opts);
    }
    getBlocks(params, opts) {
        return this._client.call('app.bsky.graph.getBlocks', params, undefined, opts);
    }
    getFollowers(params, opts) {
        return this._client.call('app.bsky.graph.getFollowers', params, undefined, opts);
    }
    getFollows(params, opts) {
        return this._client.call('app.bsky.graph.getFollows', params, undefined, opts);
    }
    getKnownFollowers(params, opts) {
        return this._client.call('app.bsky.graph.getKnownFollowers', params, undefined, opts);
    }
    getList(params, opts) {
        return this._client.call('app.bsky.graph.getList', params, undefined, opts);
    }
    getListBlocks(params, opts) {
        return this._client.call('app.bsky.graph.getListBlocks', params, undefined, opts);
    }
    getListMutes(params, opts) {
        return this._client.call('app.bsky.graph.getListMutes', params, undefined, opts);
    }
    getLists(params, opts) {
        return this._client.call('app.bsky.graph.getLists', params, undefined, opts);
    }
    getListsWithMembership(params, opts) {
        return this._client.call('app.bsky.graph.getListsWithMembership', params, undefined, opts);
    }
    getMutes(params, opts) {
        return this._client.call('app.bsky.graph.getMutes', params, undefined, opts);
    }
    getRelationships(params, opts) {
        return this._client
            .call('app.bsky.graph.getRelationships', params, undefined, opts)
            .catch((e) => {
            throw AppBskyGraphGetRelationships.toKnownErr(e);
        });
    }
    getStarterPack(params, opts) {
        return this._client.call('app.bsky.graph.getStarterPack', params, undefined, opts);
    }
    getStarterPacks(params, opts) {
        return this._client.call('app.bsky.graph.getStarterPacks', params, undefined, opts);
    }
    getStarterPacksWithMembership(params, opts) {
        return this._client.call('app.bsky.graph.getStarterPacksWithMembership', params, undefined, opts);
    }
    getSuggestedFollowsByActor(params, opts) {
        return this._client.call('app.bsky.graph.getSuggestedFollowsByActor', params, undefined, opts);
    }
    muteActor(data, opts) {
        return this._client.call('app.bsky.graph.muteActor', opts?.qp, data, opts);
    }
    muteActorList(data, opts) {
        return this._client.call('app.bsky.graph.muteActorList', opts?.qp, data, opts);
    }
    muteThread(data, opts) {
        return this._client.call('app.bsky.graph.muteThread', opts?.qp, data, opts);
    }
    searchStarterPacks(params, opts) {
        return this._client.call('app.bsky.graph.searchStarterPacks', params, undefined, opts);
    }
    unmuteActor(data, opts) {
        return this._client.call('app.bsky.graph.unmuteActor', opts?.qp, data, opts);
    }
    unmuteActorList(data, opts) {
        return this._client.call('app.bsky.graph.unmuteActorList', opts?.qp, data, opts);
    }
    unmuteThread(data, opts) {
        return this._client.call('app.bsky.graph.unmuteThread', opts?.qp, data, opts);
    }
}
exports.AppBskyGraphNS = AppBskyGraphNS;
class AppBskyGraphBlockRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.graph.block',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.graph.block',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.graph.block';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.graph.block';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.graph.block', ...params }, { headers });
    }
}
exports.AppBskyGraphBlockRecord = AppBskyGraphBlockRecord;
class AppBskyGraphFollowRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.graph.follow',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.graph.follow',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.graph.follow';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.graph.follow';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.graph.follow', ...params }, { headers });
    }
}
exports.AppBskyGraphFollowRecord = AppBskyGraphFollowRecord;
class AppBskyGraphListRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.graph.list',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.graph.list',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.graph.list';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.graph.list';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.graph.list', ...params }, { headers });
    }
}
exports.AppBskyGraphListRecord = AppBskyGraphListRecord;
class AppBskyGraphListblockRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.graph.listblock',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.graph.listblock',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.graph.listblock';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.graph.listblock';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.graph.listblock', ...params }, { headers });
    }
}
exports.AppBskyGraphListblockRecord = AppBskyGraphListblockRecord;
class AppBskyGraphListitemRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.graph.listitem',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.graph.listitem',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.graph.listitem';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.graph.listitem';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.graph.listitem', ...params }, { headers });
    }
}
exports.AppBskyGraphListitemRecord = AppBskyGraphListitemRecord;
class AppBskyGraphStarterpackRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.graph.starterpack',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.graph.starterpack',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.graph.starterpack';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.graph.starterpack';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.graph.starterpack', ...params }, { headers });
    }
}
exports.AppBskyGraphStarterpackRecord = AppBskyGraphStarterpackRecord;
class AppBskyGraphVerificationRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.graph.verification',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.graph.verification',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.graph.verification';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.graph.verification';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.graph.verification', ...params }, { headers });
    }
}
exports.AppBskyGraphVerificationRecord = AppBskyGraphVerificationRecord;
class AppBskyLabelerNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "service", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.service = new AppBskyLabelerServiceRecord(client);
    }
    getServices(params, opts) {
        return this._client.call('app.bsky.labeler.getServices', params, undefined, opts);
    }
}
exports.AppBskyLabelerNS = AppBskyLabelerNS;
class AppBskyLabelerServiceRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.labeler.service',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.labeler.service',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.labeler.service';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, {
            collection,
            rkey: 'self',
            ...params,
            record: { ...record, $type: collection },
        }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.labeler.service';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.labeler.service', ...params }, { headers });
    }
}
exports.AppBskyLabelerServiceRecord = AppBskyLabelerServiceRecord;
class AppBskyNotificationNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "declaration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.declaration = new AppBskyNotificationDeclarationRecord(client);
    }
    getPreferences(params, opts) {
        return this._client.call('app.bsky.notification.getPreferences', params, undefined, opts);
    }
    getUnreadCount(params, opts) {
        return this._client.call('app.bsky.notification.getUnreadCount', params, undefined, opts);
    }
    listActivitySubscriptions(params, opts) {
        return this._client.call('app.bsky.notification.listActivitySubscriptions', params, undefined, opts);
    }
    listNotifications(params, opts) {
        return this._client.call('app.bsky.notification.listNotifications', params, undefined, opts);
    }
    putActivitySubscription(data, opts) {
        return this._client.call('app.bsky.notification.putActivitySubscription', opts?.qp, data, opts);
    }
    putPreferences(data, opts) {
        return this._client.call('app.bsky.notification.putPreferences', opts?.qp, data, opts);
    }
    putPreferencesV2(data, opts) {
        return this._client.call('app.bsky.notification.putPreferencesV2', opts?.qp, data, opts);
    }
    registerPush(data, opts) {
        return this._client.call('app.bsky.notification.registerPush', opts?.qp, data, opts);
    }
    unregisterPush(data, opts) {
        return this._client.call('app.bsky.notification.unregisterPush', opts?.qp, data, opts);
    }
    updateSeen(data, opts) {
        return this._client.call('app.bsky.notification.updateSeen', opts?.qp, data, opts);
    }
}
exports.AppBskyNotificationNS = AppBskyNotificationNS;
class AppBskyNotificationDeclarationRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'app.bsky.notification.declaration',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'app.bsky.notification.declaration',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'app.bsky.notification.declaration';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, {
            collection,
            rkey: 'self',
            ...params,
            record: { ...record, $type: collection },
        }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'app.bsky.notification.declaration';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'app.bsky.notification.declaration', ...params }, { headers });
    }
}
exports.AppBskyNotificationDeclarationRecord = AppBskyNotificationDeclarationRecord;
class AppBskyRichtextNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
}
exports.AppBskyRichtextNS = AppBskyRichtextNS;
class AppBskyUnspeccedNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    getAgeAssuranceState(params, opts) {
        return this._client.call('app.bsky.unspecced.getAgeAssuranceState', params, undefined, opts);
    }
    getConfig(params, opts) {
        return this._client.call('app.bsky.unspecced.getConfig', params, undefined, opts);
    }
    getOnboardingSuggestedStarterPacks(params, opts) {
        return this._client.call('app.bsky.unspecced.getOnboardingSuggestedStarterPacks', params, undefined, opts);
    }
    getOnboardingSuggestedStarterPacksSkeleton(params, opts) {
        return this._client.call('app.bsky.unspecced.getOnboardingSuggestedStarterPacksSkeleton', params, undefined, opts);
    }
    getPopularFeedGenerators(params, opts) {
        return this._client.call('app.bsky.unspecced.getPopularFeedGenerators', params, undefined, opts);
    }
    getPostThreadOtherV2(params, opts) {
        return this._client.call('app.bsky.unspecced.getPostThreadOtherV2', params, undefined, opts);
    }
    getPostThreadV2(params, opts) {
        return this._client.call('app.bsky.unspecced.getPostThreadV2', params, undefined, opts);
    }
    getSuggestedFeeds(params, opts) {
        return this._client.call('app.bsky.unspecced.getSuggestedFeeds', params, undefined, opts);
    }
    getSuggestedFeedsSkeleton(params, opts) {
        return this._client.call('app.bsky.unspecced.getSuggestedFeedsSkeleton', params, undefined, opts);
    }
    getSuggestedStarterPacks(params, opts) {
        return this._client.call('app.bsky.unspecced.getSuggestedStarterPacks', params, undefined, opts);
    }
    getSuggestedStarterPacksSkeleton(params, opts) {
        return this._client.call('app.bsky.unspecced.getSuggestedStarterPacksSkeleton', params, undefined, opts);
    }
    getSuggestedUsers(params, opts) {
        return this._client.call('app.bsky.unspecced.getSuggestedUsers', params, undefined, opts);
    }
    getSuggestedUsersSkeleton(params, opts) {
        return this._client.call('app.bsky.unspecced.getSuggestedUsersSkeleton', params, undefined, opts);
    }
    getSuggestionsSkeleton(params, opts) {
        return this._client.call('app.bsky.unspecced.getSuggestionsSkeleton', params, undefined, opts);
    }
    getTaggedSuggestions(params, opts) {
        return this._client.call('app.bsky.unspecced.getTaggedSuggestions', params, undefined, opts);
    }
    getTrendingTopics(params, opts) {
        return this._client.call('app.bsky.unspecced.getTrendingTopics', params, undefined, opts);
    }
    getTrends(params, opts) {
        return this._client.call('app.bsky.unspecced.getTrends', params, undefined, opts);
    }
    getTrendsSkeleton(params, opts) {
        return this._client.call('app.bsky.unspecced.getTrendsSkeleton', params, undefined, opts);
    }
    initAgeAssurance(data, opts) {
        return this._client
            .call('app.bsky.unspecced.initAgeAssurance', opts?.qp, data, opts)
            .catch((e) => {
            throw AppBskyUnspeccedInitAgeAssurance.toKnownErr(e);
        });
    }
    searchActorsSkeleton(params, opts) {
        return this._client
            .call('app.bsky.unspecced.searchActorsSkeleton', params, undefined, opts)
            .catch((e) => {
            throw AppBskyUnspeccedSearchActorsSkeleton.toKnownErr(e);
        });
    }
    searchPostsSkeleton(params, opts) {
        return this._client
            .call('app.bsky.unspecced.searchPostsSkeleton', params, undefined, opts)
            .catch((e) => {
            throw AppBskyUnspeccedSearchPostsSkeleton.toKnownErr(e);
        });
    }
    searchStarterPacksSkeleton(params, opts) {
        return this._client
            .call('app.bsky.unspecced.searchStarterPacksSkeleton', params, undefined, opts)
            .catch((e) => {
            throw AppBskyUnspeccedSearchStarterPacksSkeleton.toKnownErr(e);
        });
    }
}
exports.AppBskyUnspeccedNS = AppBskyUnspeccedNS;
class AppBskyVideoNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    getJobStatus(params, opts) {
        return this._client.call('app.bsky.video.getJobStatus', params, undefined, opts);
    }
    getUploadLimits(params, opts) {
        return this._client.call('app.bsky.video.getUploadLimits', params, undefined, opts);
    }
    uploadVideo(data, opts) {
        return this._client.call('app.bsky.video.uploadVideo', opts?.qp, data, opts);
    }
}
exports.AppBskyVideoNS = AppBskyVideoNS;
class ChatNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bsky", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.bsky = new ChatBskyNS(client);
    }
}
exports.ChatNS = ChatNS;
class ChatBskyNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "actor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "convo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "moderation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.actor = new ChatBskyActorNS(client);
        this.convo = new ChatBskyConvoNS(client);
        this.moderation = new ChatBskyModerationNS(client);
    }
}
exports.ChatBskyNS = ChatBskyNS;
class ChatBskyActorNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "declaration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.declaration = new ChatBskyActorDeclarationRecord(client);
    }
    deleteAccount(data, opts) {
        return this._client.call('chat.bsky.actor.deleteAccount', opts?.qp, data, opts);
    }
    exportAccountData(params, opts) {
        return this._client.call('chat.bsky.actor.exportAccountData', params, undefined, opts);
    }
}
exports.ChatBskyActorNS = ChatBskyActorNS;
class ChatBskyActorDeclarationRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'chat.bsky.actor.declaration',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'chat.bsky.actor.declaration',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'chat.bsky.actor.declaration';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, {
            collection,
            rkey: 'self',
            ...params,
            record: { ...record, $type: collection },
        }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'chat.bsky.actor.declaration';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'chat.bsky.actor.declaration', ...params }, { headers });
    }
}
exports.ChatBskyActorDeclarationRecord = ChatBskyActorDeclarationRecord;
class ChatBskyConvoNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    acceptConvo(data, opts) {
        return this._client.call('chat.bsky.convo.acceptConvo', opts?.qp, data, opts);
    }
    addReaction(data, opts) {
        return this._client
            .call('chat.bsky.convo.addReaction', opts?.qp, data, opts)
            .catch((e) => {
            throw ChatBskyConvoAddReaction.toKnownErr(e);
        });
    }
    deleteMessageForSelf(data, opts) {
        return this._client.call('chat.bsky.convo.deleteMessageForSelf', opts?.qp, data, opts);
    }
    getConvo(params, opts) {
        return this._client.call('chat.bsky.convo.getConvo', params, undefined, opts);
    }
    getConvoAvailability(params, opts) {
        return this._client.call('chat.bsky.convo.getConvoAvailability', params, undefined, opts);
    }
    getConvoForMembers(params, opts) {
        return this._client.call('chat.bsky.convo.getConvoForMembers', params, undefined, opts);
    }
    getLog(params, opts) {
        return this._client.call('chat.bsky.convo.getLog', params, undefined, opts);
    }
    getMessages(params, opts) {
        return this._client.call('chat.bsky.convo.getMessages', params, undefined, opts);
    }
    leaveConvo(data, opts) {
        return this._client.call('chat.bsky.convo.leaveConvo', opts?.qp, data, opts);
    }
    listConvos(params, opts) {
        return this._client.call('chat.bsky.convo.listConvos', params, undefined, opts);
    }
    muteConvo(data, opts) {
        return this._client.call('chat.bsky.convo.muteConvo', opts?.qp, data, opts);
    }
    removeReaction(data, opts) {
        return this._client
            .call('chat.bsky.convo.removeReaction', opts?.qp, data, opts)
            .catch((e) => {
            throw ChatBskyConvoRemoveReaction.toKnownErr(e);
        });
    }
    sendMessage(data, opts) {
        return this._client.call('chat.bsky.convo.sendMessage', opts?.qp, data, opts);
    }
    sendMessageBatch(data, opts) {
        return this._client.call('chat.bsky.convo.sendMessageBatch', opts?.qp, data, opts);
    }
    unmuteConvo(data, opts) {
        return this._client.call('chat.bsky.convo.unmuteConvo', opts?.qp, data, opts);
    }
    updateAllRead(data, opts) {
        return this._client.call('chat.bsky.convo.updateAllRead', opts?.qp, data, opts);
    }
    updateRead(data, opts) {
        return this._client.call('chat.bsky.convo.updateRead', opts?.qp, data, opts);
    }
}
exports.ChatBskyConvoNS = ChatBskyConvoNS;
class ChatBskyModerationNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    getActorMetadata(params, opts) {
        return this._client.call('chat.bsky.moderation.getActorMetadata', params, undefined, opts);
    }
    getMessageContext(params, opts) {
        return this._client.call('chat.bsky.moderation.getMessageContext', params, undefined, opts);
    }
    updateActorAccess(data, opts) {
        return this._client.call('chat.bsky.moderation.updateActorAccess', opts?.qp, data, opts);
    }
}
exports.ChatBskyModerationNS = ChatBskyModerationNS;
class ComNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "atproto", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.atproto = new ComAtprotoNS(client);
    }
}
exports.ComNS = ComNS;
class ComAtprotoNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "admin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "identity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lexicon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "moderation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "repo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "server", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sync", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "temp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.admin = new ComAtprotoAdminNS(client);
        this.identity = new ComAtprotoIdentityNS(client);
        this.label = new ComAtprotoLabelNS(client);
        this.lexicon = new ComAtprotoLexiconNS(client);
        this.moderation = new ComAtprotoModerationNS(client);
        this.repo = new ComAtprotoRepoNS(client);
        this.server = new ComAtprotoServerNS(client);
        this.sync = new ComAtprotoSyncNS(client);
        this.temp = new ComAtprotoTempNS(client);
    }
}
exports.ComAtprotoNS = ComAtprotoNS;
class ComAtprotoAdminNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    deleteAccount(data, opts) {
        return this._client.call('com.atproto.admin.deleteAccount', opts?.qp, data, opts);
    }
    disableAccountInvites(data, opts) {
        return this._client.call('com.atproto.admin.disableAccountInvites', opts?.qp, data, opts);
    }
    disableInviteCodes(data, opts) {
        return this._client.call('com.atproto.admin.disableInviteCodes', opts?.qp, data, opts);
    }
    enableAccountInvites(data, opts) {
        return this._client.call('com.atproto.admin.enableAccountInvites', opts?.qp, data, opts);
    }
    getAccountInfo(params, opts) {
        return this._client.call('com.atproto.admin.getAccountInfo', params, undefined, opts);
    }
    getAccountInfos(params, opts) {
        return this._client.call('com.atproto.admin.getAccountInfos', params, undefined, opts);
    }
    getInviteCodes(params, opts) {
        return this._client.call('com.atproto.admin.getInviteCodes', params, undefined, opts);
    }
    getSubjectStatus(params, opts) {
        return this._client.call('com.atproto.admin.getSubjectStatus', params, undefined, opts);
    }
    searchAccounts(params, opts) {
        return this._client.call('com.atproto.admin.searchAccounts', params, undefined, opts);
    }
    sendEmail(data, opts) {
        return this._client.call('com.atproto.admin.sendEmail', opts?.qp, data, opts);
    }
    updateAccountEmail(data, opts) {
        return this._client.call('com.atproto.admin.updateAccountEmail', opts?.qp, data, opts);
    }
    updateAccountHandle(data, opts) {
        return this._client.call('com.atproto.admin.updateAccountHandle', opts?.qp, data, opts);
    }
    updateAccountPassword(data, opts) {
        return this._client.call('com.atproto.admin.updateAccountPassword', opts?.qp, data, opts);
    }
    updateAccountSigningKey(data, opts) {
        return this._client.call('com.atproto.admin.updateAccountSigningKey', opts?.qp, data, opts);
    }
    updateSubjectStatus(data, opts) {
        return this._client.call('com.atproto.admin.updateSubjectStatus', opts?.qp, data, opts);
    }
}
exports.ComAtprotoAdminNS = ComAtprotoAdminNS;
class ComAtprotoIdentityNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    getRecommendedDidCredentials(params, opts) {
        return this._client.call('com.atproto.identity.getRecommendedDidCredentials', params, undefined, opts);
    }
    refreshIdentity(data, opts) {
        return this._client
            .call('com.atproto.identity.refreshIdentity', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoIdentityRefreshIdentity.toKnownErr(e);
        });
    }
    requestPlcOperationSignature(data, opts) {
        return this._client.call('com.atproto.identity.requestPlcOperationSignature', opts?.qp, data, opts);
    }
    resolveDid(params, opts) {
        return this._client
            .call('com.atproto.identity.resolveDid', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoIdentityResolveDid.toKnownErr(e);
        });
    }
    resolveHandle(params, opts) {
        return this._client
            .call('com.atproto.identity.resolveHandle', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoIdentityResolveHandle.toKnownErr(e);
        });
    }
    resolveIdentity(params, opts) {
        return this._client
            .call('com.atproto.identity.resolveIdentity', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoIdentityResolveIdentity.toKnownErr(e);
        });
    }
    signPlcOperation(data, opts) {
        return this._client.call('com.atproto.identity.signPlcOperation', opts?.qp, data, opts);
    }
    submitPlcOperation(data, opts) {
        return this._client.call('com.atproto.identity.submitPlcOperation', opts?.qp, data, opts);
    }
    updateHandle(data, opts) {
        return this._client.call('com.atproto.identity.updateHandle', opts?.qp, data, opts);
    }
}
exports.ComAtprotoIdentityNS = ComAtprotoIdentityNS;
class ComAtprotoLabelNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    queryLabels(params, opts) {
        return this._client.call('com.atproto.label.queryLabels', params, undefined, opts);
    }
}
exports.ComAtprotoLabelNS = ComAtprotoLabelNS;
class ComAtprotoLexiconNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.schema = new ComAtprotoLexiconSchemaRecord(client);
    }
    resolveLexicon(params, opts) {
        return this._client
            .call('com.atproto.lexicon.resolveLexicon', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoLexiconResolveLexicon.toKnownErr(e);
        });
    }
}
exports.ComAtprotoLexiconNS = ComAtprotoLexiconNS;
class ComAtprotoLexiconSchemaRecord {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    async list(params) {
        const res = await this._client.call('com.atproto.repo.listRecords', {
            collection: 'com.atproto.lexicon.schema',
            ...params,
        });
        return res.data;
    }
    async get(params) {
        const res = await this._client.call('com.atproto.repo.getRecord', {
            collection: 'com.atproto.lexicon.schema',
            ...params,
        });
        return res.data;
    }
    async create(params, record, headers) {
        const collection = 'com.atproto.lexicon.schema';
        const res = await this._client.call('com.atproto.repo.createRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async put(params, record, headers) {
        const collection = 'com.atproto.lexicon.schema';
        const res = await this._client.call('com.atproto.repo.putRecord', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers });
        return res.data;
    }
    async delete(params, headers) {
        await this._client.call('com.atproto.repo.deleteRecord', undefined, { collection: 'com.atproto.lexicon.schema', ...params }, { headers });
    }
}
exports.ComAtprotoLexiconSchemaRecord = ComAtprotoLexiconSchemaRecord;
class ComAtprotoModerationNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    createReport(data, opts) {
        return this._client.call('com.atproto.moderation.createReport', opts?.qp, data, opts);
    }
}
exports.ComAtprotoModerationNS = ComAtprotoModerationNS;
class ComAtprotoRepoNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    applyWrites(data, opts) {
        return this._client
            .call('com.atproto.repo.applyWrites', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoRepoApplyWrites.toKnownErr(e);
        });
    }
    createRecord(data, opts) {
        return this._client
            .call('com.atproto.repo.createRecord', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoRepoCreateRecord.toKnownErr(e);
        });
    }
    deleteRecord(data, opts) {
        return this._client
            .call('com.atproto.repo.deleteRecord', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoRepoDeleteRecord.toKnownErr(e);
        });
    }
    describeRepo(params, opts) {
        return this._client.call('com.atproto.repo.describeRepo', params, undefined, opts);
    }
    getRecord(params, opts) {
        return this._client
            .call('com.atproto.repo.getRecord', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoRepoGetRecord.toKnownErr(e);
        });
    }
    importRepo(data, opts) {
        return this._client.call('com.atproto.repo.importRepo', opts?.qp, data, opts);
    }
    listMissingBlobs(params, opts) {
        return this._client.call('com.atproto.repo.listMissingBlobs', params, undefined, opts);
    }
    listRecords(params, opts) {
        return this._client.call('com.atproto.repo.listRecords', params, undefined, opts);
    }
    putRecord(data, opts) {
        return this._client
            .call('com.atproto.repo.putRecord', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoRepoPutRecord.toKnownErr(e);
        });
    }
    uploadBlob(data, opts) {
        return this._client.call('com.atproto.repo.uploadBlob', opts?.qp, data, opts);
    }
}
exports.ComAtprotoRepoNS = ComAtprotoRepoNS;
class ComAtprotoServerNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    activateAccount(data, opts) {
        return this._client.call('com.atproto.server.activateAccount', opts?.qp, data, opts);
    }
    checkAccountStatus(params, opts) {
        return this._client.call('com.atproto.server.checkAccountStatus', params, undefined, opts);
    }
    confirmEmail(data, opts) {
        return this._client
            .call('com.atproto.server.confirmEmail', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerConfirmEmail.toKnownErr(e);
        });
    }
    createAccount(data, opts) {
        return this._client
            .call('com.atproto.server.createAccount', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerCreateAccount.toKnownErr(e);
        });
    }
    createAppPassword(data, opts) {
        return this._client
            .call('com.atproto.server.createAppPassword', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerCreateAppPassword.toKnownErr(e);
        });
    }
    createInviteCode(data, opts) {
        return this._client.call('com.atproto.server.createInviteCode', opts?.qp, data, opts);
    }
    createInviteCodes(data, opts) {
        return this._client.call('com.atproto.server.createInviteCodes', opts?.qp, data, opts);
    }
    createSession(data, opts) {
        return this._client
            .call('com.atproto.server.createSession', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerCreateSession.toKnownErr(e);
        });
    }
    deactivateAccount(data, opts) {
        return this._client.call('com.atproto.server.deactivateAccount', opts?.qp, data, opts);
    }
    deleteAccount(data, opts) {
        return this._client
            .call('com.atproto.server.deleteAccount', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerDeleteAccount.toKnownErr(e);
        });
    }
    deleteSession(data, opts) {
        return this._client.call('com.atproto.server.deleteSession', opts?.qp, data, opts);
    }
    describeServer(params, opts) {
        return this._client.call('com.atproto.server.describeServer', params, undefined, opts);
    }
    getAccountInviteCodes(params, opts) {
        return this._client
            .call('com.atproto.server.getAccountInviteCodes', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoServerGetAccountInviteCodes.toKnownErr(e);
        });
    }
    getServiceAuth(params, opts) {
        return this._client
            .call('com.atproto.server.getServiceAuth', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoServerGetServiceAuth.toKnownErr(e);
        });
    }
    getSession(params, opts) {
        return this._client.call('com.atproto.server.getSession', params, undefined, opts);
    }
    listAppPasswords(params, opts) {
        return this._client
            .call('com.atproto.server.listAppPasswords', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoServerListAppPasswords.toKnownErr(e);
        });
    }
    refreshSession(data, opts) {
        return this._client
            .call('com.atproto.server.refreshSession', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerRefreshSession.toKnownErr(e);
        });
    }
    requestAccountDelete(data, opts) {
        return this._client.call('com.atproto.server.requestAccountDelete', opts?.qp, data, opts);
    }
    requestEmailConfirmation(data, opts) {
        return this._client.call('com.atproto.server.requestEmailConfirmation', opts?.qp, data, opts);
    }
    requestEmailUpdate(data, opts) {
        return this._client.call('com.atproto.server.requestEmailUpdate', opts?.qp, data, opts);
    }
    requestPasswordReset(data, opts) {
        return this._client.call('com.atproto.server.requestPasswordReset', opts?.qp, data, opts);
    }
    reserveSigningKey(data, opts) {
        return this._client.call('com.atproto.server.reserveSigningKey', opts?.qp, data, opts);
    }
    resetPassword(data, opts) {
        return this._client
            .call('com.atproto.server.resetPassword', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerResetPassword.toKnownErr(e);
        });
    }
    revokeAppPassword(data, opts) {
        return this._client.call('com.atproto.server.revokeAppPassword', opts?.qp, data, opts);
    }
    updateEmail(data, opts) {
        return this._client
            .call('com.atproto.server.updateEmail', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoServerUpdateEmail.toKnownErr(e);
        });
    }
}
exports.ComAtprotoServerNS = ComAtprotoServerNS;
class ComAtprotoSyncNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    getBlob(params, opts) {
        return this._client
            .call('com.atproto.sync.getBlob', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetBlob.toKnownErr(e);
        });
    }
    getBlocks(params, opts) {
        return this._client
            .call('com.atproto.sync.getBlocks', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetBlocks.toKnownErr(e);
        });
    }
    getCheckout(params, opts) {
        return this._client.call('com.atproto.sync.getCheckout', params, undefined, opts);
    }
    getHead(params, opts) {
        return this._client
            .call('com.atproto.sync.getHead', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetHead.toKnownErr(e);
        });
    }
    getHostStatus(params, opts) {
        return this._client
            .call('com.atproto.sync.getHostStatus', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetHostStatus.toKnownErr(e);
        });
    }
    getLatestCommit(params, opts) {
        return this._client
            .call('com.atproto.sync.getLatestCommit', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetLatestCommit.toKnownErr(e);
        });
    }
    getRecord(params, opts) {
        return this._client
            .call('com.atproto.sync.getRecord', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetRecord.toKnownErr(e);
        });
    }
    getRepo(params, opts) {
        return this._client
            .call('com.atproto.sync.getRepo', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetRepo.toKnownErr(e);
        });
    }
    getRepoStatus(params, opts) {
        return this._client
            .call('com.atproto.sync.getRepoStatus', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncGetRepoStatus.toKnownErr(e);
        });
    }
    listBlobs(params, opts) {
        return this._client
            .call('com.atproto.sync.listBlobs', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoSyncListBlobs.toKnownErr(e);
        });
    }
    listHosts(params, opts) {
        return this._client.call('com.atproto.sync.listHosts', params, undefined, opts);
    }
    listRepos(params, opts) {
        return this._client.call('com.atproto.sync.listRepos', params, undefined, opts);
    }
    listReposByCollection(params, opts) {
        return this._client.call('com.atproto.sync.listReposByCollection', params, undefined, opts);
    }
    notifyOfUpdate(data, opts) {
        return this._client.call('com.atproto.sync.notifyOfUpdate', opts?.qp, data, opts);
    }
    requestCrawl(data, opts) {
        return this._client
            .call('com.atproto.sync.requestCrawl', opts?.qp, data, opts)
            .catch((e) => {
            throw ComAtprotoSyncRequestCrawl.toKnownErr(e);
        });
    }
}
exports.ComAtprotoSyncNS = ComAtprotoSyncNS;
class ComAtprotoTempNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    addReservedHandle(data, opts) {
        return this._client.call('com.atproto.temp.addReservedHandle', opts?.qp, data, opts);
    }
    checkHandleAvailability(params, opts) {
        return this._client
            .call('com.atproto.temp.checkHandleAvailability', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoTempCheckHandleAvailability.toKnownErr(e);
        });
    }
    checkSignupQueue(params, opts) {
        return this._client.call('com.atproto.temp.checkSignupQueue', params, undefined, opts);
    }
    dereferenceScope(params, opts) {
        return this._client
            .call('com.atproto.temp.dereferenceScope', params, undefined, opts)
            .catch((e) => {
            throw ComAtprotoTempDereferenceScope.toKnownErr(e);
        });
    }
    fetchLabels(params, opts) {
        return this._client.call('com.atproto.temp.fetchLabels', params, undefined, opts);
    }
    requestPhoneVerification(data, opts) {
        return this._client.call('com.atproto.temp.requestPhoneVerification', opts?.qp, data, opts);
    }
    revokeAccountCredentials(data, opts) {
        return this._client.call('com.atproto.temp.revokeAccountCredentials', opts?.qp, data, opts);
    }
}
exports.ComAtprotoTempNS = ComAtprotoTempNS;
class ToolsNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ozone", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.ozone = new ToolsOzoneNS(client);
    }
}
exports.ToolsNS = ToolsNS;
class ToolsOzoneNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "communication", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hosting", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "moderation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "safelink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "server", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "set", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "setting", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "signature", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "team", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "verification", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.communication = new ToolsOzoneCommunicationNS(client);
        this.hosting = new ToolsOzoneHostingNS(client);
        this.moderation = new ToolsOzoneModerationNS(client);
        this.safelink = new ToolsOzoneSafelinkNS(client);
        this.server = new ToolsOzoneServerNS(client);
        this.set = new ToolsOzoneSetNS(client);
        this.setting = new ToolsOzoneSettingNS(client);
        this.signature = new ToolsOzoneSignatureNS(client);
        this.team = new ToolsOzoneTeamNS(client);
        this.verification = new ToolsOzoneVerificationNS(client);
    }
}
exports.ToolsOzoneNS = ToolsOzoneNS;
class ToolsOzoneCommunicationNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    createTemplate(data, opts) {
        return this._client
            .call('tools.ozone.communication.createTemplate', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneCommunicationCreateTemplate.toKnownErr(e);
        });
    }
    deleteTemplate(data, opts) {
        return this._client.call('tools.ozone.communication.deleteTemplate', opts?.qp, data, opts);
    }
    listTemplates(params, opts) {
        return this._client.call('tools.ozone.communication.listTemplates', params, undefined, opts);
    }
    updateTemplate(data, opts) {
        return this._client
            .call('tools.ozone.communication.updateTemplate', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneCommunicationUpdateTemplate.toKnownErr(e);
        });
    }
}
exports.ToolsOzoneCommunicationNS = ToolsOzoneCommunicationNS;
class ToolsOzoneHostingNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    getAccountHistory(params, opts) {
        return this._client.call('tools.ozone.hosting.getAccountHistory', params, undefined, opts);
    }
}
exports.ToolsOzoneHostingNS = ToolsOzoneHostingNS;
class ToolsOzoneModerationNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    cancelScheduledActions(data, opts) {
        return this._client.call('tools.ozone.moderation.cancelScheduledActions', opts?.qp, data, opts);
    }
    emitEvent(data, opts) {
        return this._client
            .call('tools.ozone.moderation.emitEvent', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneModerationEmitEvent.toKnownErr(e);
        });
    }
    getAccountTimeline(params, opts) {
        return this._client
            .call('tools.ozone.moderation.getAccountTimeline', params, undefined, opts)
            .catch((e) => {
            throw ToolsOzoneModerationGetAccountTimeline.toKnownErr(e);
        });
    }
    getEvent(params, opts) {
        return this._client.call('tools.ozone.moderation.getEvent', params, undefined, opts);
    }
    getRecord(params, opts) {
        return this._client
            .call('tools.ozone.moderation.getRecord', params, undefined, opts)
            .catch((e) => {
            throw ToolsOzoneModerationGetRecord.toKnownErr(e);
        });
    }
    getRecords(params, opts) {
        return this._client.call('tools.ozone.moderation.getRecords', params, undefined, opts);
    }
    getRepo(params, opts) {
        return this._client
            .call('tools.ozone.moderation.getRepo', params, undefined, opts)
            .catch((e) => {
            throw ToolsOzoneModerationGetRepo.toKnownErr(e);
        });
    }
    getReporterStats(params, opts) {
        return this._client.call('tools.ozone.moderation.getReporterStats', params, undefined, opts);
    }
    getRepos(params, opts) {
        return this._client.call('tools.ozone.moderation.getRepos', params, undefined, opts);
    }
    getSubjects(params, opts) {
        return this._client.call('tools.ozone.moderation.getSubjects', params, undefined, opts);
    }
    listScheduledActions(data, opts) {
        return this._client.call('tools.ozone.moderation.listScheduledActions', opts?.qp, data, opts);
    }
    queryEvents(params, opts) {
        return this._client.call('tools.ozone.moderation.queryEvents', params, undefined, opts);
    }
    queryStatuses(params, opts) {
        return this._client.call('tools.ozone.moderation.queryStatuses', params, undefined, opts);
    }
    scheduleAction(data, opts) {
        return this._client.call('tools.ozone.moderation.scheduleAction', opts?.qp, data, opts);
    }
    searchRepos(params, opts) {
        return this._client.call('tools.ozone.moderation.searchRepos', params, undefined, opts);
    }
}
exports.ToolsOzoneModerationNS = ToolsOzoneModerationNS;
class ToolsOzoneSafelinkNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    addRule(data, opts) {
        return this._client
            .call('tools.ozone.safelink.addRule', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneSafelinkAddRule.toKnownErr(e);
        });
    }
    queryEvents(data, opts) {
        return this._client.call('tools.ozone.safelink.queryEvents', opts?.qp, data, opts);
    }
    queryRules(data, opts) {
        return this._client.call('tools.ozone.safelink.queryRules', opts?.qp, data, opts);
    }
    removeRule(data, opts) {
        return this._client
            .call('tools.ozone.safelink.removeRule', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneSafelinkRemoveRule.toKnownErr(e);
        });
    }
    updateRule(data, opts) {
        return this._client
            .call('tools.ozone.safelink.updateRule', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneSafelinkUpdateRule.toKnownErr(e);
        });
    }
}
exports.ToolsOzoneSafelinkNS = ToolsOzoneSafelinkNS;
class ToolsOzoneServerNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    getConfig(params, opts) {
        return this._client.call('tools.ozone.server.getConfig', params, undefined, opts);
    }
}
exports.ToolsOzoneServerNS = ToolsOzoneServerNS;
class ToolsOzoneSetNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    addValues(data, opts) {
        return this._client.call('tools.ozone.set.addValues', opts?.qp, data, opts);
    }
    deleteSet(data, opts) {
        return this._client
            .call('tools.ozone.set.deleteSet', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneSetDeleteSet.toKnownErr(e);
        });
    }
    deleteValues(data, opts) {
        return this._client
            .call('tools.ozone.set.deleteValues', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneSetDeleteValues.toKnownErr(e);
        });
    }
    getValues(params, opts) {
        return this._client
            .call('tools.ozone.set.getValues', params, undefined, opts)
            .catch((e) => {
            throw ToolsOzoneSetGetValues.toKnownErr(e);
        });
    }
    querySets(params, opts) {
        return this._client.call('tools.ozone.set.querySets', params, undefined, opts);
    }
    upsertSet(data, opts) {
        return this._client.call('tools.ozone.set.upsertSet', opts?.qp, data, opts);
    }
}
exports.ToolsOzoneSetNS = ToolsOzoneSetNS;
class ToolsOzoneSettingNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    listOptions(params, opts) {
        return this._client.call('tools.ozone.setting.listOptions', params, undefined, opts);
    }
    removeOptions(data, opts) {
        return this._client.call('tools.ozone.setting.removeOptions', opts?.qp, data, opts);
    }
    upsertOption(data, opts) {
        return this._client.call('tools.ozone.setting.upsertOption', opts?.qp, data, opts);
    }
}
exports.ToolsOzoneSettingNS = ToolsOzoneSettingNS;
class ToolsOzoneSignatureNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    findCorrelation(params, opts) {
        return this._client.call('tools.ozone.signature.findCorrelation', params, undefined, opts);
    }
    findRelatedAccounts(params, opts) {
        return this._client.call('tools.ozone.signature.findRelatedAccounts', params, undefined, opts);
    }
    searchAccounts(params, opts) {
        return this._client.call('tools.ozone.signature.searchAccounts', params, undefined, opts);
    }
}
exports.ToolsOzoneSignatureNS = ToolsOzoneSignatureNS;
class ToolsOzoneTeamNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    addMember(data, opts) {
        return this._client
            .call('tools.ozone.team.addMember', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneTeamAddMember.toKnownErr(e);
        });
    }
    deleteMember(data, opts) {
        return this._client
            .call('tools.ozone.team.deleteMember', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneTeamDeleteMember.toKnownErr(e);
        });
    }
    listMembers(params, opts) {
        return this._client.call('tools.ozone.team.listMembers', params, undefined, opts);
    }
    updateMember(data, opts) {
        return this._client
            .call('tools.ozone.team.updateMember', opts?.qp, data, opts)
            .catch((e) => {
            throw ToolsOzoneTeamUpdateMember.toKnownErr(e);
        });
    }
}
exports.ToolsOzoneTeamNS = ToolsOzoneTeamNS;
class ToolsOzoneVerificationNS {
    constructor(client) {
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
    }
    grantVerifications(data, opts) {
        return this._client.call('tools.ozone.verification.grantVerifications', opts?.qp, data, opts);
    }
    listVerifications(params, opts) {
        return this._client.call('tools.ozone.verification.listVerifications', params, undefined, opts);
    }
    revokeVerifications(data, opts) {
        return this._client.call('tools.ozone.verification.revokeVerifications', opts?.qp, data, opts);
    }
}
exports.ToolsOzoneVerificationNS = ToolsOzoneVerificationNS;
//# sourceMappingURL=index.js.map