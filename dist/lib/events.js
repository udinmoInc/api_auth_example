"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authEvents = void 0;
const events_1 = require("events");
const logger_1 = __importDefault(require("@/utils/logger"));
class SafeEventEmitter extends events_1.EventEmitter {
    constructor() {
        super();
        // Allow substantial third-party plugin registrations without triggering memory leak warnings
        this.setMaxListeners(100);
    }
    /**
     * Safe emission wrapper executing listeners in the next tick of the event loop.
     * This isolates core request execution from secondary plugin side-effects.
     */
    emit(event, ...args) {
        process.nextTick(() => {
            try {
                super.emit(event, ...args);
            }
            catch (error) {
                logger_1.default.error(`❌ [SafeEvent] Exception thrown inside listener callback for event [${String(event)}]:`, error);
            }
        });
        return true;
    }
}
// Global loose-coupling event emitter instance
exports.authEvents = new SafeEventEmitter();
exports.default = exports.authEvents;
