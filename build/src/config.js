"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const path_1 = __importDefault(require("path"));
exports.config = {
    localUserProject: {
        use: false,
        path: path_1.default.resolve(process.cwd(), '../../user-templates/typescript-template'),
    },
};
//# sourceMappingURL=config.js.map