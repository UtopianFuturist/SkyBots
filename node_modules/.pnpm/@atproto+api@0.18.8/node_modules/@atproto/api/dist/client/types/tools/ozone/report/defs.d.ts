export type ReasonType = 'tools.ozone.report.defs#reasonAppeal' | 'tools.ozone.report.defs#reasonOther' | 'tools.ozone.report.defs#reasonViolenceAnimal' | 'tools.ozone.report.defs#reasonViolenceThreats' | 'tools.ozone.report.defs#reasonViolenceGraphicContent' | 'tools.ozone.report.defs#reasonViolenceGlorification' | 'tools.ozone.report.defs#reasonViolenceExtremistContent' | 'tools.ozone.report.defs#reasonViolenceTrafficking' | 'tools.ozone.report.defs#reasonViolenceOther' | 'tools.ozone.report.defs#reasonSexualAbuseContent' | 'tools.ozone.report.defs#reasonSexualNCII' | 'tools.ozone.report.defs#reasonSexualDeepfake' | 'tools.ozone.report.defs#reasonSexualAnimal' | 'tools.ozone.report.defs#reasonSexualUnlabeled' | 'tools.ozone.report.defs#reasonSexualOther' | 'tools.ozone.report.defs#reasonChildSafetyCSAM' | 'tools.ozone.report.defs#reasonChildSafetyGroom' | 'tools.ozone.report.defs#reasonChildSafetyPrivacy' | 'tools.ozone.report.defs#reasonChildSafetyHarassment' | 'tools.ozone.report.defs#reasonChildSafetyOther' | 'tools.ozone.report.defs#reasonHarassmentTroll' | 'tools.ozone.report.defs#reasonHarassmentTargeted' | 'tools.ozone.report.defs#reasonHarassmentHateSpeech' | 'tools.ozone.report.defs#reasonHarassmentDoxxing' | 'tools.ozone.report.defs#reasonHarassmentOther' | 'tools.ozone.report.defs#reasonMisleadingBot' | 'tools.ozone.report.defs#reasonMisleadingImpersonation' | 'tools.ozone.report.defs#reasonMisleadingSpam' | 'tools.ozone.report.defs#reasonMisleadingScam' | 'tools.ozone.report.defs#reasonMisleadingElections' | 'tools.ozone.report.defs#reasonMisleadingOther' | 'tools.ozone.report.defs#reasonRuleSiteSecurity' | 'tools.ozone.report.defs#reasonRuleProhibitedSales' | 'tools.ozone.report.defs#reasonRuleBanEvasion' | 'tools.ozone.report.defs#reasonRuleOther' | 'tools.ozone.report.defs#reasonSelfHarmContent' | 'tools.ozone.report.defs#reasonSelfHarmED' | 'tools.ozone.report.defs#reasonSelfHarmStunts' | 'tools.ozone.report.defs#reasonSelfHarmSubstances' | 'tools.ozone.report.defs#reasonSelfHarmOther' | (string & {});
/** Appeal a previously taken moderation action */
export declare const REASONAPPEAL = "tools.ozone.report.defs#reasonAppeal";
/** An issue not included in these options */
export declare const REASONOTHER = "tools.ozone.report.defs#reasonOther";
/** Animal welfare violations */
export declare const REASONVIOLENCEANIMAL = "tools.ozone.report.defs#reasonViolenceAnimal";
/** Threats or incitement */
export declare const REASONVIOLENCETHREATS = "tools.ozone.report.defs#reasonViolenceThreats";
/** Graphic violent content */
export declare const REASONVIOLENCEGRAPHICCONTENT = "tools.ozone.report.defs#reasonViolenceGraphicContent";
/** Glorification of violence */
export declare const REASONVIOLENCEGLORIFICATION = "tools.ozone.report.defs#reasonViolenceGlorification";
/** Extremist content. These reports will be sent only be sent to the application's Moderation Authority. */
export declare const REASONVIOLENCEEXTREMISTCONTENT = "tools.ozone.report.defs#reasonViolenceExtremistContent";
/** Human trafficking */
export declare const REASONVIOLENCETRAFFICKING = "tools.ozone.report.defs#reasonViolenceTrafficking";
/** Other violent content */
export declare const REASONVIOLENCEOTHER = "tools.ozone.report.defs#reasonViolenceOther";
/** Adult sexual abuse content */
export declare const REASONSEXUALABUSECONTENT = "tools.ozone.report.defs#reasonSexualAbuseContent";
/** Non-consensual intimate imagery */
export declare const REASONSEXUALNCII = "tools.ozone.report.defs#reasonSexualNCII";
/** Deepfake adult content */
export declare const REASONSEXUALDEEPFAKE = "tools.ozone.report.defs#reasonSexualDeepfake";
/** Animal sexual abuse */
export declare const REASONSEXUALANIMAL = "tools.ozone.report.defs#reasonSexualAnimal";
/** Unlabelled adult content */
export declare const REASONSEXUALUNLABELED = "tools.ozone.report.defs#reasonSexualUnlabeled";
/** Other sexual violence content */
export declare const REASONSEXUALOTHER = "tools.ozone.report.defs#reasonSexualOther";
/** Child sexual abuse material (CSAM). These reports will be sent only be sent to the application's Moderation Authority. */
export declare const REASONCHILDSAFETYCSAM = "tools.ozone.report.defs#reasonChildSafetyCSAM";
/** Grooming or predatory behavior. These reports will be sent only be sent to the application's Moderation Authority. */
export declare const REASONCHILDSAFETYGROOM = "tools.ozone.report.defs#reasonChildSafetyGroom";
/** Privacy violation involving a minor */
export declare const REASONCHILDSAFETYPRIVACY = "tools.ozone.report.defs#reasonChildSafetyPrivacy";
/** Harassment or bullying of minors */
export declare const REASONCHILDSAFETYHARASSMENT = "tools.ozone.report.defs#reasonChildSafetyHarassment";
/** Other child safety. These reports will be sent only be sent to the application's Moderation Authority. */
export declare const REASONCHILDSAFETYOTHER = "tools.ozone.report.defs#reasonChildSafetyOther";
/** Trolling */
export declare const REASONHARASSMENTTROLL = "tools.ozone.report.defs#reasonHarassmentTroll";
/** Targeted harassment */
export declare const REASONHARASSMENTTARGETED = "tools.ozone.report.defs#reasonHarassmentTargeted";
/** Hate speech */
export declare const REASONHARASSMENTHATESPEECH = "tools.ozone.report.defs#reasonHarassmentHateSpeech";
/** Doxxing */
export declare const REASONHARASSMENTDOXXING = "tools.ozone.report.defs#reasonHarassmentDoxxing";
/** Other harassing or hateful content */
export declare const REASONHARASSMENTOTHER = "tools.ozone.report.defs#reasonHarassmentOther";
/** Fake account or bot */
export declare const REASONMISLEADINGBOT = "tools.ozone.report.defs#reasonMisleadingBot";
/** Impersonation */
export declare const REASONMISLEADINGIMPERSONATION = "tools.ozone.report.defs#reasonMisleadingImpersonation";
/** Spam */
export declare const REASONMISLEADINGSPAM = "tools.ozone.report.defs#reasonMisleadingSpam";
/** Scam */
export declare const REASONMISLEADINGSCAM = "tools.ozone.report.defs#reasonMisleadingScam";
/** False information about elections */
export declare const REASONMISLEADINGELECTIONS = "tools.ozone.report.defs#reasonMisleadingElections";
/** Other misleading content */
export declare const REASONMISLEADINGOTHER = "tools.ozone.report.defs#reasonMisleadingOther";
/** Hacking or system attacks */
export declare const REASONRULESITESECURITY = "tools.ozone.report.defs#reasonRuleSiteSecurity";
/** Promoting or selling prohibited items or services */
export declare const REASONRULEPROHIBITEDSALES = "tools.ozone.report.defs#reasonRuleProhibitedSales";
/** Banned user returning */
export declare const REASONRULEBANEVASION = "tools.ozone.report.defs#reasonRuleBanEvasion";
/** Other */
export declare const REASONRULEOTHER = "tools.ozone.report.defs#reasonRuleOther";
/** Content promoting or depicting self-harm */
export declare const REASONSELFHARMCONTENT = "tools.ozone.report.defs#reasonSelfHarmContent";
/** Eating disorders */
export declare const REASONSELFHARMED = "tools.ozone.report.defs#reasonSelfHarmED";
/** Dangerous challenges or activities */
export declare const REASONSELFHARMSTUNTS = "tools.ozone.report.defs#reasonSelfHarmStunts";
/** Dangerous substances or drug abuse */
export declare const REASONSELFHARMSUBSTANCES = "tools.ozone.report.defs#reasonSelfHarmSubstances";
/** Other dangerous content */
export declare const REASONSELFHARMOTHER = "tools.ozone.report.defs#reasonSelfHarmOther";
//# sourceMappingURL=defs.d.ts.map