"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const age_assurance_1 = require("./age-assurance");
(0, globals_1.describe)('age-assurance', () => {
    (0, globals_1.describe)('getAgeAssuranceRegionConfig', () => {
        const config = {
            regions: [
                {
                    countryCode: 'US',
                    regionCode: 'CA',
                    rules: [],
                },
                {
                    countryCode: 'US',
                    rules: [],
                },
            ],
        };
        (0, globals_1.it)('should find region by country code only', () => {
            const result = (0, age_assurance_1.getAgeAssuranceRegionConfig)(config, {
                countryCode: 'US',
            });
            (0, globals_1.expect)(result).toEqual({
                countryCode: 'US',
                rules: [],
            });
        });
        (0, globals_1.it)('should find region by country code and region code', () => {
            const result = (0, age_assurance_1.getAgeAssuranceRegionConfig)(config, {
                countryCode: 'US',
                regionCode: 'CA',
            });
            (0, globals_1.expect)(result).toEqual({
                countryCode: 'US',
                regionCode: 'CA',
                rules: [],
            });
        });
        (0, globals_1.it)('should return undefined when no matching region found', () => {
            const result = (0, age_assurance_1.getAgeAssuranceRegionConfig)(config, {
                countryCode: 'GB',
            });
            (0, globals_1.expect)(result).toBeUndefined();
        });
    });
    (0, globals_1.describe)('computeAgeAssuranceRegionAccess', () => {
        const region = {
            countryCode: 'US',
            rules: [
                {
                    $type: age_assurance_1.ageAssuranceRuleIDs.IfAccountNewerThan,
                    date: '2025-12-10T00:00:00Z',
                    access: 'none',
                },
                {
                    $type: age_assurance_1.ageAssuranceRuleIDs.IfAssuredOverAge,
                    age: 18,
                    access: 'full',
                },
                {
                    $type: age_assurance_1.ageAssuranceRuleIDs.IfAssuredOverAge,
                    age: 16,
                    access: 'safe',
                },
                {
                    $type: age_assurance_1.ageAssuranceRuleIDs.IfDeclaredOverAge,
                    age: 16,
                    access: 'safe',
                },
                {
                    $type: age_assurance_1.ageAssuranceRuleIDs.Default,
                    access: 'none',
                },
            ],
        };
        (0, globals_1.it)('should apply default if no data provided', () => {
            const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {});
            (0, globals_1.expect)(result).toEqual({
                access: 'none',
                reason: age_assurance_1.ageAssuranceRuleIDs.Default,
            });
        });
        (0, globals_1.describe)('IfAccountNewerThan', () => {
            (0, globals_1.it)('should block accounts created after threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    accountCreatedAt: new Date(2025, 11, 15).toISOString(),
                    declaredAge: 18,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'none',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfAccountNewerThan,
                });
            });
            (0, globals_1.it)('should allow accounts created before threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    accountCreatedAt: new Date(2025, 10, 1).toISOString(),
                    declaredAge: 18,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'safe',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfDeclaredOverAge,
                });
            });
            (0, globals_1.it)('should allow accounts created exactly at threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    accountCreatedAt: new Date(2025, 11, 1).toISOString(),
                    declaredAge: 18,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'safe',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfDeclaredOverAge,
                });
            });
            (0, globals_1.it)('should not apply rule when accountCreatedAt is not provided', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    declaredAge: 15,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'none',
                    reason: age_assurance_1.ageAssuranceRuleIDs.Default,
                });
            });
            (0, globals_1.it)('should not apply rule when assuredAge is present', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    accountCreatedAt: new Date(2025, 11, 15).toISOString(),
                    assuredAge: 20,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'full',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfAssuredOverAge,
                });
            });
        });
        (0, globals_1.describe)('IfDeclaredOverAge rule', () => {
            (0, globals_1.it)('should allow users at or above age threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    declaredAge: 18,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'safe',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfDeclaredOverAge,
                });
            });
            (0, globals_1.it)('should allow users above age threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    declaredAge: 25,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'safe',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfDeclaredOverAge,
                });
            });
            (0, globals_1.it)('should not allow users below age threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    declaredAge: 17,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'safe',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfDeclaredOverAge,
                });
            });
        });
        (0, globals_1.describe)('IfAssuredOverAge rule', () => {
            (0, globals_1.it)('should allow users at or above assured age threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    assuredAge: 18,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'full',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfAssuredOverAge,
                });
            });
            (0, globals_1.it)('should not allow users below assured age threshold', () => {
                const result = (0, age_assurance_1.computeAgeAssuranceRegionAccess)(region, {
                    assuredAge: 17,
                });
                (0, globals_1.expect)(result).toEqual({
                    access: 'safe',
                    reason: age_assurance_1.ageAssuranceRuleIDs.IfAssuredOverAge,
                });
            });
        });
    });
});
//# sourceMappingURL=age-assurance.test.js.map