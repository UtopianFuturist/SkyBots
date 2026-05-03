"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ageAssuranceRuleIDs = void 0;
exports.getAgeAssuranceRegionConfig = getAgeAssuranceRegionConfig;
exports.computeAgeAssuranceRegionAccess = computeAgeAssuranceRegionAccess;
const client_1 = require("./client");
const lexicons_1 = require("./client/lexicons");
exports.ageAssuranceRuleIDs = {
    Default: `${lexicons_1.ids.AppBskyAgeassuranceDefs}#configRegionRuleDefault`,
    IfDeclaredOverAge: `${lexicons_1.ids.AppBskyAgeassuranceDefs}#configRegionRuleIfDeclaredOverAge`,
    IfDeclaredUnderAge: `${lexicons_1.ids.AppBskyAgeassuranceDefs}#configRegionRuleIfDeclaredUnderAge`,
    IfAssuredOverAge: `${lexicons_1.ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAssuredOverAge`,
    IfAssuredUnderAge: `${lexicons_1.ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAssuredUnderAge`,
    IfAccountNewerThan: `${lexicons_1.ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAccountNewerThan`,
    IfAccountOlderThan: `${lexicons_1.ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAccountOlderThan`,
};
/**
 * Returns the first matched region configuration based on the provided geolocation.
 */
function getAgeAssuranceRegionConfig(config, geolocation) {
    const { regions } = config;
    return regions.find(({ countryCode, regionCode }) => {
        if (countryCode === geolocation.countryCode) {
            return !regionCode || regionCode === geolocation.regionCode;
        }
    });
}
function computeAgeAssuranceRegionAccess(region, data) {
    // first match wins
    for (const rule of region.rules) {
        if (client_1.AppBskyAgeassuranceDefs.isConfigRegionRuleIfAccountNewerThan(rule)) {
            if (data?.accountCreatedAt && !data?.assuredAge) {
                const accountCreatedAt = new Date(data.accountCreatedAt);
                const threshold = new Date(rule.date);
                if (accountCreatedAt >= threshold) {
                    return {
                        access: rule.access,
                        reason: rule.$type,
                    };
                }
            }
        }
        else if (client_1.AppBskyAgeassuranceDefs.isConfigRegionRuleIfAccountOlderThan(rule)) {
            if (data?.accountCreatedAt && !data?.assuredAge) {
                const accountCreatedAt = new Date(data.accountCreatedAt);
                const threshold = new Date(rule.date);
                if (accountCreatedAt < threshold) {
                    return {
                        access: rule.access,
                        reason: rule.$type,
                    };
                }
            }
        }
        else if (client_1.AppBskyAgeassuranceDefs.isConfigRegionRuleIfDeclaredOverAge(rule)) {
            if (data?.declaredAge !== undefined && data.declaredAge >= rule.age) {
                return {
                    access: rule.access,
                    reason: rule.$type,
                };
            }
        }
        else if (client_1.AppBskyAgeassuranceDefs.isConfigRegionRuleIfDeclaredUnderAge(rule)) {
            if (data?.declaredAge !== undefined && data.declaredAge < rule.age) {
                return {
                    access: rule.access,
                    reason: rule.$type,
                };
            }
        }
        else if (client_1.AppBskyAgeassuranceDefs.isConfigRegionRuleIfAssuredOverAge(rule)) {
            if (data?.assuredAge && data.assuredAge >= rule.age) {
                return {
                    access: rule.access,
                    reason: rule.$type,
                };
            }
        }
        else if (client_1.AppBskyAgeassuranceDefs.isConfigRegionRuleIfAssuredUnderAge(rule)) {
            if (data?.assuredAge && data.assuredAge < rule.age) {
                return {
                    access: rule.access,
                    reason: rule.$type,
                };
            }
        }
        else if (client_1.AppBskyAgeassuranceDefs.isConfigRegionRuleDefault(rule)) {
            return {
                access: rule.access,
                reason: rule.$type,
            };
        }
    }
}
//# sourceMappingURL=age-assurance.js.map