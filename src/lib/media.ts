import { createHash } from "node:crypto";
import { createMoonrakerBaseUrl } from "./moonraker";

const DEFAULT_MEDIA_TIMEOUT_MS = 10_000;

export interface Camera {
	uid: string;
	name: string;
	enabled: boolean;
	stream_url: string;
	snapshot_url: string;
	service: string;
	rotation: number;
	flip_horizontal: boolean;
	flip_vertical: boolean;
}

export interface GcodeFileMetadata {
	estimatedTime?: number;
	slicer?: string;
	slicerVersion?: string;
	thumbnails: Array<{ width: number; height: number; relativePath: string }>;
}

export async function mediaRequest(
	host: string,
	port: number,
	path: string,
	timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
	const response = await fetch(new URL(path, createMoonrakerBaseUrl(host, port)), {
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) {
		throw new Error(`Media request failed: HTTP ${response.status}`);
	}
	const body = (await response.json()) as { result?: Record<string, unknown> };
	if (!body.result) {
		throw new Error("Invalid Moonraker media response");
	}
	return body.result;
}

export async function discoverCameras(
	host: string,
	port: number,
	timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS,
): Promise<Camera[]> {
	const result = await mediaRequest(host, port, "/server/webcams/list", timeoutMs);
	if (!Array.isArray(result.webcams)) {
		throw new Error("Invalid webcam list");
	}
	return result.webcams.filter(
		(camera): camera is Camera =>
			typeof camera === "object" &&
			camera !== null &&
			typeof camera.uid === "string" &&
			camera.uid.length > 0 &&
			typeof camera.name === "string",
	);
}

/**
 * Builds a stable, namespace-safe camera object ID without case-only
 * collisions. Normal lower-case UUIDs retain their existing readable ID.
 *
 * @param uid Moonraker camera identifier.
 */
export function cameraObjectId(uid: string): string {
	const sanitized = uid.replace(/[^a-zA-Z0-9_-]/g, "_");
	if (sanitized === uid && uid === uid.toLowerCase()) {
		return uid;
	}
	const digest = createHash("sha256").update(uid).digest("hex").slice(0, 12);
	return `${sanitized.toLowerCase()}-${digest}`;
}

export function cameraUrl(value: string, host: string): string {
	if (!value) {
		return "";
	}
	const url = new URL(value, `http://${host}/`);
	return ["http:", "https:", "rtsp:"].includes(url.protocol) ? url.toString() : "";
}

/** Retrieves the subset of Moonraker G-code metadata used by the adapter. */
export async function getGcodeFileMetadata(
	host: string,
	port: number,
	filename: string,
	timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS,
): Promise<GcodeFileMetadata | undefined> {
	if (!filename) {
		return undefined;
	}
	const metadata = await mediaRequest(
		host,
		port,
		`/server/files/metadata?filename=${encodeURIComponent(filename)}`,
		timeoutMs,
	);
	const estimatedTime = metadata.estimated_time;
	const slicer = metadata.slicer;
	const slicerVersion = metadata.slicer_version;
	const thumbnails = Array.isArray(metadata.thumbnails)
		? metadata.thumbnails.flatMap(value => {
				if (typeof value !== "object" || value === null || Array.isArray(value)) {
					return [];
				}
				const thumbnail = value as Record<string, unknown>;
				return typeof thumbnail.width === "number" &&
					typeof thumbnail.height === "number" &&
					typeof thumbnail.relative_path === "string"
					? [{ width: thumbnail.width, height: thumbnail.height, relativePath: thumbnail.relative_path }]
					: [];
			})
		: [];
	return {
		...(typeof estimatedTime === "number" && Number.isFinite(estimatedTime) && estimatedTime >= 0
			? { estimatedTime }
			: {}),
		...(typeof slicer === "string" ? { slicer } : {}),
		...(typeof slicerVersion === "string" ? { slicerVersion } : {}),
		thumbnails,
	};
}

/** Builds the largest embedded G-code thumbnail URL from already fetched metadata. */
export function previewUrlFromMetadata(
	metadata: GcodeFileMetadata | undefined,
	host: string,
	port: number,
	filename: string,
): string {
	if (!filename) {
		return "";
	}
	const thumbnail = [...(metadata?.thumbnails ?? [])]
		.filter(t => typeof t.relativePath === "string")
		.sort((a, b) => b.width * b.height - a.width * a.height)[0];
	if (!thumbnail) {
		return "";
	}
	const directory = filename.includes("/") ? filename.slice(0, filename.lastIndexOf("/") + 1) : "";
	const path = (directory + thumbnail.relativePath).split("/").map(encodeURIComponent).join("/");
	return new URL(`/server/files/gcodes/${path}`, createMoonrakerBaseUrl(host, port)).toString();
}

export async function previewUrl(
	host: string,
	port: number,
	filename: string,
	timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS,
): Promise<string> {
	if (!filename) {
		return "";
	}
	return previewUrlFromMetadata(await getGcodeFileMetadata(host, port, filename, timeoutMs), host, port, filename);
}
