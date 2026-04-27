import type { ErrorRequestHandler } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import {
	AppError,
	badRequest,
	internalError,
	notFound,
} from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const isProduction = env.NODE_ENV === "production";

const normalizeError = (error: unknown) => {
	if (error instanceof AppError) {
		return error;
	}

	if (error instanceof ZodError) {
		return badRequest("Validation failed.", error.flatten());
	}

	if (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2025"
	) {
		return notFound("Deployment not found.");
	}

	if (error instanceof Error) {
		return new AppError({
			message: error.message || "Internal server error.",
			statusCode: 500,
			code: "INTERNAL_SERVER_ERROR",
			isOperational: false,
			cause: error,
		});
	}

	return internalError();
};

export const errorHandler: ErrorRequestHandler = (
	error,
	request,
	response,
	_next,
) => {
	const normalizedError = normalizeError(error);
	const responseMessage =
		normalizedError.statusCode === 500 && isProduction
			? "Internal server error."
			: normalizedError.message;

	logger.error({
		method: request.method,
		path: request.originalUrl,
		statusCode: normalizedError.statusCode,
		code: normalizedError.code,
		message: normalizedError.message,
		details: normalizedError.details,
		cause:
			error instanceof Error && error !== normalizedError
				? error.message
				: undefined,
		stack: error instanceof Error ? error.stack : undefined,
	}, "Request failed");

	const payload: Record<string, unknown> = {
		message: responseMessage,
		code: normalizedError.code,
	};

	if (normalizedError.details !== undefined) {
		payload.details = normalizedError.details;
	}

	response.status(normalizedError.statusCode).json(payload);
};
