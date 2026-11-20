/**
 * Provides the self-description returned for the ioBroker `help` message.
 *
 * The text deliberately stays in English because it is intended for script
 * authors and AI agents, independent of the Admin UI language.
 */
export function getHelpResponse(): { help: string; commands: { command: string; write: boolean }[] } {
	return {
		help: [
			"This adapter monitors a Snapmaker U1 through its configured local Moonraker service.",
			"It exposes connection status at info.connection and printer telemetry and controls below printer.*.",
			"The only sendTo message is discoverCameras. It accepts no payload and returns enabled cameras as an array of { label, value } objects, where value is the Moonraker camera UID.",
			"discoverCameras only reads the configured Moonraker endpoint and does not change the printer, adapter configuration, or ioBroker states.",
			"Fan and guarded PAXX12 controls are written through their documented ioBroker states; no write messages are supported.",
		].join(" "),
		commands: [{ command: "discoverCameras", write: false }],
	};
}
