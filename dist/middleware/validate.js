"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const asyncHandler_1 = __importDefault(require("@/utils/asyncHandler"));
const validate = (schema) => {
    return (0, asyncHandler_1.default)(async (req, _res, next) => {
        if (schema.body) {
            req.body = await schema.body.parseAsync(req.body);
        }
        if (schema.query) {
            req.query = (await schema.query.parseAsync(req.query));
        }
        if (schema.params) {
            req.params = (await schema.params.parseAsync(req.params));
        }
        next();
    });
};
exports.validate = validate;
exports.default = exports.validate;
