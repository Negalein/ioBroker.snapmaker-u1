import { createMoonrakerBaseUrl } from "./moonraker";

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

export async function mediaRequest(host: string, port: number, path: string): Promise<Record<string, unknown>> {
	const response = await fetch(new URL(path, createMoonrakerBaseUrl(host, port)), {
		signal: AbortSignal.timeout(10_000),
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

export async function discoverCameras(host: string, port: number): Promise<Camera[]> {
	const result = await mediaRequest(host, port, "/server/webcams/list");
	if (!Array.isArray(result.webcams)) {
		throw new Error("Invalid webcam list");
	}
	return result.webcams.filter(
		(camera): camera is Camera =>
			typeof camera === "object" &&
			camera !== null &&
			typeof camera.uid === "string" &&
			typeof camera.name === "string",
	);
}

export function cameraUrl(value: string, host: string): string {
	if (!value) {
		return "";
	}
	const url = new URL(value, `http://${host}/`);
	return ["http:", "https:", "rtsp:"].includes(url.protocol) ? url.toString() : "";
}

export async function previewUrl(host: string, port: number, filename: string): Promise<string> {
	if (!filename) {
		return "";
	}
	const metadata = await mediaRequest(host, port, `/server/files/metadata?filename=${encodeURIComponent(filename)}`);
	const thumbnails = metadata.thumbnails as
		Array<{ width: number; height: number; relative_path: string }> | undefined;
	const thumbnail = thumbnails
		?.filter(t => typeof t.relative_path === "string")
		.sort((a, b) => b.width * b.height - a.width * a.height)[0];
	if (!thumbnail) {
		return "";
	}
	const directory = filename.includes("/") ? filename.slice(0, filename.lastIndexOf("/") + 1) : "";
	const path = (directory + thumbnail.relative_path).split("/").map(encodeURIComponent).join("/");
	return new URL(`/server/files/gcodes/${path}`, createMoonrakerBaseUrl(host, port)).toString();
}
