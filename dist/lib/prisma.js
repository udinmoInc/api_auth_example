"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
// In Prisma 7, a driver adapter must be instantiated and passed at runtime
const connectionString = config_1.default.db.url;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = global.prisma ||
    new client_1.PrismaClient({
        adapter,
        log: config_1.default.env === 'development'
            ? [
                { emit: 'event', level: 'query' },
                { emit: 'stdout', level: 'error' },
                { emit: 'stdout', level: 'warn' },
            ]
            : ['error'],
    });
if (config_1.default.env === 'development') {
    global.prisma = exports.prisma;
    // Log queries in development
    exports.prisma.$on('query', (e) => {
        logger_1.default.debug(`Prisma Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
    });
}
exports.default = exports.prisma;
