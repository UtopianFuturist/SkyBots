"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REASONSELFHARMOTHER = exports.REASONSELFHARMSUBSTANCES = exports.REASONSELFHARMSTUNTS = exports.REASONSELFHARMED = exports.REASONSELFHARMCONTENT = exports.REASONRULEOTHER = exports.REASONRULEBANEVASION = exports.REASONRULEPROHIBITEDSALES = exports.REASONRULESITESECURITY = exports.REASONMISLEADINGOTHER = exports.REASONMISLEADINGELECTIONS = exports.REASONMISLEADINGSCAM = exports.REASONMISLEADINGSPAM = exports.REASONMISLEADINGIMPERSONATION = exports.REASONMISLEADINGBOT = exports.REASONHARASSMENTOTHER = exports.REASONHARASSMENTDOXXING = exports.REASONHARASSMENTHATESPEECH = exports.REASONHARASSMENTTARGETED = exports.REASONHARASSMENTTROLL = exports.REASONCHILDSAFETYOTHER = exports.REASONCHILDSAFETYHARASSMENT = exports.REASONCHILDSAFETYPRIVACY = exports.REASONCHILDSAFETYGROOM = exports.REASONCHILDSAFETYCSAM = exports.REASONSEXUALOTHER = exports.REASONSEXUALUNLABELED = exports.REASONSEXUALANIMAL = exports.REASONSEXUALDEEPFAKE = exports.REASONSEXUALNCII = exports.REASONSEXUALABUSECONTENT = exports.REASONVIOLENCEOTHER = exports.REASONVIOLENCETRAFFICKING = exports.REASONVIOLENCEEXTREMISTCONTENT = exports.REASONVIOLENCEGLORIFICATION = exports.REASONVIOLENCEGRAPHICCONTENT = exports.REASONVIOLENCETHREATS = exports.REASONVIOLENCEANIMAL = exports.REASONOTHER = exports.REASONAPPEAL = void 0;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'tools.ozone.report.defs';
/** Appeal a previously taken moderation action */
exports.REASONAPPEAL = `${id}#reasonAppeal`;
/** An issue not included in these options */
exports.REASONOTHER = `${id}#reasonOther`;
/** Animal welfare violations */
exports.REASONVIOLENCEANIMAL = `${id}#reasonViolenceAnimal`;
/** Threats or incitement */
exports.REASONVIOLENCETHREATS = `${id}#reasonViolenceThreats`;
/** Graphic violent content */
exports.REASONVIOLENCEGRAPHICCONTENT = `${id}#reasonViolenceGraphicContent`;
/** Glorification of violence */
exports.REASONVIOLENCEGLORIFICATION = `${id}#reasonViolenceGlorification`;
/** Extremist content. These reports will be sent only be sent to the application's Moderation Authority. */
exports.REASONVIOLENCEEXTREMISTCONTENT = `${id}#reasonViolenceExtremistContent`;
/** Human trafficking */
exports.REASONVIOLENCETRAFFICKING = `${id}#reasonViolenceTrafficking`;
/** Other violent content */
exports.REASONVIOLENCEOTHER = `${id}#reasonViolenceOther`;
/** Adult sexual abuse content */
exports.REASONSEXUALABUSECONTENT = `${id}#reasonSexualAbuseContent`;
/** Non-consensual intimate imagery */
exports.REASONSEXUALNCII = `${id}#reasonSexualNCII`;
/** Deepfake adult content */
exports.REASONSEXUALDEEPFAKE = `${id}#reasonSexualDeepfake`;
/** Animal sexual abuse */
exports.REASONSEXUALANIMAL = `${id}#reasonSexualAnimal`;
/** Unlabelled adult content */
exports.REASONSEXUALUNLABELED = `${id}#reasonSexualUnlabeled`;
/** Other sexual violence content */
exports.REASONSEXUALOTHER = `${id}#reasonSexualOther`;
/** Child sexual abuse material (CSAM). These reports will be sent only be sent to the application's Moderation Authority. */
exports.REASONCHILDSAFETYCSAM = `${id}#reasonChildSafetyCSAM`;
/** Grooming or predatory behavior. These reports will be sent only be sent to the application's Moderation Authority. */
exports.REASONCHILDSAFETYGROOM = `${id}#reasonChildSafetyGroom`;
/** Privacy violation involving a minor */
exports.REASONCHILDSAFETYPRIVACY = `${id}#reasonChildSafetyPrivacy`;
/** Harassment or bullying of minors */
exports.REASONCHILDSAFETYHARASSMENT = `${id}#reasonChildSafetyHarassment`;
/** Other child safety. These reports will be sent only be sent to the application's Moderation Authority. */
exports.REASONCHILDSAFETYOTHER = `${id}#reasonChildSafetyOther`;
/** Trolling */
exports.REASONHARASSMENTTROLL = `${id}#reasonHarassmentTroll`;
/** Targeted harassment */
exports.REASONHARASSMENTTARGETED = `${id}#reasonHarassmentTargeted`;
/** Hate speech */
exports.REASONHARASSMENTHATESPEECH = `${id}#reasonHarassmentHateSpeech`;
/** Doxxing */
exports.REASONHARASSMENTDOXXING = `${id}#reasonHarassmentDoxxing`;
/** Other harassing or hateful content */
exports.REASONHARASSMENTOTHER = `${id}#reasonHarassmentOther`;
/** Fake account or bot */
exports.REASONMISLEADINGBOT = `${id}#reasonMisleadingBot`;
/** Impersonation */
exports.REASONMISLEADINGIMPERSONATION = `${id}#reasonMisleadingImpersonation`;
/** Spam */
exports.REASONMISLEADINGSPAM = `${id}#reasonMisleadingSpam`;
/** Scam */
exports.REASONMISLEADINGSCAM = `${id}#reasonMisleadingScam`;
/** False information about elections */
exports.REASONMISLEADINGELECTIONS = `${id}#reasonMisleadingElections`;
/** Other misleading content */
exports.REASONMISLEADINGOTHER = `${id}#reasonMisleadingOther`;
/** Hacking or system attacks */
exports.REASONRULESITESECURITY = `${id}#reasonRuleSiteSecurity`;
/** Promoting or selling prohibited items or services */
exports.REASONRULEPROHIBITEDSALES = `${id}#reasonRuleProhibitedSales`;
/** Banned user returning */
exports.REASONRULEBANEVASION = `${id}#reasonRuleBanEvasion`;
/** Other */
exports.REASONRULEOTHER = `${id}#reasonRuleOther`;
/** Content promoting or depicting self-harm */
exports.REASONSELFHARMCONTENT = `${id}#reasonSelfHarmContent`;
/** Eating disorders */
exports.REASONSELFHARMED = `${id}#reasonSelfHarmED`;
/** Dangerous challenges or activities */
exports.REASONSELFHARMSTUNTS = `${id}#reasonSelfHarmStunts`;
/** Dangerous substances or drug abuse */
exports.REASONSELFHARMSUBSTANCES = `${id}#reasonSelfHarmSubstances`;
/** Other dangerous content */
exports.REASONSELFHARMOTHER = `${id}#reasonSelfHarmOther`;
//# sourceMappingURL=defs.js.map