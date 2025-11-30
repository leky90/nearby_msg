/**
 * Structured logging using pino
 * Provides structured, searchable logs with appropriate log levels
 */

import pino from 'pino';

// Determine if we're in production
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

// Configure logger based on environment
const loggerConfig: pino.LoggerOptions = {
	level: isProduction ? 'info' : 'debug',
	...(isProduction
		? {
				// Production: structured JSON output
				formatters: {
					level: (label) => {
						return { level: label };
					},
				},
			}
		: {
				// Development: human-readable output
				transport: {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'HH:MM:ss Z',
						ignore: 'pid,hostname',
					},
				},
			}),
};

// Create and export logger instance
export const logger = pino(loggerConfig);

// Export convenience methods
export const log = {
	debug: (msg: string, ...args: unknown[]) => logger.debug(args.length > 0 ? { ...args } : {}, msg),
	info: (msg: string, ...args: unknown[]) => logger.info(args.length > 0 ? { ...args } : {}, msg),
	warn: (msg: string, ...args: unknown[]) => logger.warn(args.length > 0 ? { ...args } : {}, msg),
	error: (msg: string, error?: Error | unknown, ...args: unknown[]) => {
		if (error instanceof Error) {
			logger.error({ err: error, ...args }, msg);
		} else {
			logger.error(args.length > 0 ? { ...args, error } : { error }, msg);
		}
	},
};

export default logger;
