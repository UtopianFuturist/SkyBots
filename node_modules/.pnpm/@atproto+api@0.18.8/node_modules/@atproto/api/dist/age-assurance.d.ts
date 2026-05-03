import { AppBskyAgeassuranceDefs } from './client';
export type AgeAssuranceRuleID = Exclude<AppBskyAgeassuranceDefs.ConfigRegionRuleDefault['$type'] | AppBskyAgeassuranceDefs.ConfigRegionRuleIfDeclaredOverAge['$type'] | AppBskyAgeassuranceDefs.ConfigRegionRuleIfDeclaredUnderAge['$type'] | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAssuredOverAge['$type'] | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAssuredUnderAge['$type'] | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAccountNewerThan['$type'] | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAccountOlderThan['$type'], undefined>;
export declare const ageAssuranceRuleIDs: Record<string, AgeAssuranceRuleID>;
/**
 * Returns the first matched region configuration based on the provided geolocation.
 */
export declare function getAgeAssuranceRegionConfig(config: AppBskyAgeassuranceDefs.Config, geolocation: {
    countryCode: string;
    regionCode?: string;
}): AppBskyAgeassuranceDefs.ConfigRegion | undefined;
export declare function computeAgeAssuranceRegionAccess(region: AppBskyAgeassuranceDefs.ConfigRegion, data: {
    /**
     * The account creation date in ISO 8601 format. Only checked if we
     * don't have an assured age, such as on the client.
     */
    accountCreatedAt?: string;
    /**
     * The user's declared age
     */
    declaredAge?: number;
    /**
     * The user's minimum age as assured by a trusted third party.
     */
    assuredAge?: number;
} | undefined): {
    access: AppBskyAgeassuranceDefs.Access;
    reason: AgeAssuranceRuleID;
} | undefined;
//# sourceMappingURL=age-assurance.d.ts.map