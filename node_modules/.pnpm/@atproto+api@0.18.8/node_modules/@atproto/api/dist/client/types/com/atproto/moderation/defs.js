"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REASONAPPEAL = exports.REASONOTHER = exports.REASONRUDE = exports.REASONSEXUAL = exports.REASONMISLEADING = exports.REASONVIOLATION = exports.REASONSPAM = void 0;
const lexicons_1 = require("../../../../lexicons");
const util_1 = require("../../../../util");
const is$typed = util_1.is$typed, validate = lexicons_1.validate;
const id = 'com.atproto.moderation.defs';
/** Spam: frequent unwanted promotion, replies, mentions. Prefer new lexicon definition `tools.ozone.report.defs#reasonMisleadingSpam`. */
exports.REASONSPAM = `${id}#reasonSpam`;
/** Direct violation of server rules, laws, terms of service. Prefer new lexicon definition `tools.ozone.report.defs#reasonRuleOther`. */
exports.REASONVIOLATION = `${id}#reasonViolation`;
/** Misleading identity, affiliation, or content. Prefer new lexicon definition `tools.ozone.report.defs#reasonMisleadingOther`. */
exports.REASONMISLEADING = `${id}#reasonMisleading`;
/** Unwanted or mislabeled sexual content. Prefer new lexicon definition `tools.ozone.report.defs#reasonSexualUnlabeled`. */
exports.REASONSEXUAL = `${id}#reasonSexual`;
/** Rude, harassing, explicit, or otherwise unwelcoming behavior. Prefer new lexicon definition `tools.ozone.report.defs#reasonHarassmentOther`. */
exports.REASONRUDE = `${id}#reasonRude`;
/** Reports not falling under another report category. Prefer new lexicon definition `tools.ozone.report.defs#reasonOther`. */
exports.REASONOTHER = `${id}#reasonOther`;
/** Appeal a previously taken moderation action */
exports.REASONAPPEAL = `${id}#reasonAppeal`;
//# sourceMappingURL=defs.js.map