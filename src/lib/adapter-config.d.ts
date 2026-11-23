// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			selectedCameras: string[];
			previewEnabled: boolean;
			host: string;
			port: number;
			firmware: "auto" | "original" | "paxx12";
			requestTimeout: number;
			pollInterval: number;
			spoolmanEnabled: boolean;
			spoolmanUrl: string;
			spoolmanInterval: number;
			spoolmanWarnLimit: number;
			spoolmanEmptyLimit: number;
			spoolmanWeekdayStart: number;
			spoolmanWeekdayEnd: number;
			spoolmanWeekendStart: number;
			spoolmanWeekendEnd: number;
			spoolmanAlarmInWindow: boolean;
			spoolmanTelegramEnabled: boolean;
			spoolmanTelegramInstance: string;
			spoolmanTelegramUser: string;
			spoolmanLegacyMirror: boolean;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
