import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
} from "node:crypto";
import { env } from "../config/env.js";
import { internalError } from "./errors.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const key = Buffer.from(env.ENCRYPTION_KEY, "hex");

export function encrypt(plaintext: string): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, ciphertext, authTag]).toString("base64");
}

export function decrypt(payload: string): string {
	const buffer = Buffer.from(payload, "base64");
	if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
		throw internalError("Encrypted payload is malformed.");
	}

	const iv = buffer.subarray(0, IV_LENGTH);
	const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
	const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	try {
		return Buffer.concat([
			decipher.update(ciphertext),
			decipher.final(),
		]).toString("utf8");
	} catch {
		throw internalError("Failed to decrypt payload.");
	}
}
