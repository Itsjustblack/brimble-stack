export const logger = {
	error(message: string, meta?: Record<string, unknown>) {
		console.error(message, meta);
	},
	info(message: string, meta?: Record<string, unknown>) {
		console.info(message, meta);
	},
};
