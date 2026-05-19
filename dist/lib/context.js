"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextStore = void 0;
const async_hooks_1 = require("async_hooks");
// Global AsyncLocalStorage context thread pool for requests tracing
exports.contextStore = new async_hooks_1.AsyncLocalStorage();
exports.default = exports.contextStore;
