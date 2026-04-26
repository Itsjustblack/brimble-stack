export type ErrorDetails = Record<string, unknown> | unknown[] | undefined;

export class AppError extends Error {
	statusCode: number;
	code: string;
	details?: ErrorDetails;
	isOperational: boolean;

	constructor(options: {
		message: string;
		statusCode: number;
		code: string;
		details?: ErrorDetails;
		isOperational?: boolean;
		cause?: unknown;
	}) {
		super(options.message, { cause: options.cause });

		this.name = "AppError";
		this.statusCode = options.statusCode;
		this.code = options.code;
		this.details = options.details;
		this.isOperational = options.isOperational ?? true;
	}
}

export const badRequest = (message: string, details?: ErrorDetails) =>
	new AppError({
		message,
		statusCode: 400,
		code: "BAD_REQUEST",
		details,
	});

export const validationError = (message: string, details?: ErrorDetails) =>
	new AppError({
		message,
		statusCode: 400,
		code: "VALIDATION_ERROR",
		details,
	});

export const notFound = (message: string, details?: ErrorDetails) =>
	new AppError({
		message,
		statusCode: 404,
		code: "NOT_FOUND",
		details,
	});

export const conflict = (message: string, details?: ErrorDetails) =>
	new AppError({
		message,
		statusCode: 409,
		code: "CONFLICT",
		details,
	});

export const internalError = (
	message = "Internal server error.",
	details?: ErrorDetails,
) =>
	new AppError({
		message,
		statusCode: 500,
		code: "INTERNAL_SERVER_ERROR",
		details,
		isOperational: false,
	});
