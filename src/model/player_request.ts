import { Card } from "./cards";
import { CardZone } from "./field";

export type PlayerRequest = PlayerRequestZones | PlayerRequestCards | PlayerRequestYesNo | PlayerRequestOption;

export type PlayerRequestZones = {
	type: "zones";
	playerId: string;
	hint: string;
	min: number;
	max: number;
	zones: Array<CardZone>;
	callback: (chosenZones: Array<CardZone>) => void;
};

export type PlayerRequestCards = {
	type: "cards";
	playerId: string;
	hint: string;
	min: number;
	max: number;
	cards: Array<Card>;
	callback: (chosenCards: Array<Card>) => void;
};

export type PlayerRequestYesNo = {
	type: "yes_no";
	playerId: string;
	hint: string;
	callback: (choice: boolean) => void;
};

export type PlayerRequestOption = {
	type: "option";
	playerId: string;
	hint: string;
	options: Array<string>;
	callback: (choice: number) => void;
};

export type PlayerRequestConfirmation = PlayerRequestConfirmationZones | PlayerRequestConfirmationCards | PlayerRequestConfirmationYesNo | PlayerRequestConfirmationOption;

export type PlayerRequestConfirmationZones = {
	type: "zones";
	playerId: string;
	zones: Array<CardZone>;
}

export type PlayerRequestConfirmationCards = {
	type: "cards";
	playerId: string;
	cards: Array<Card>;
}

export type PlayerRequestConfirmationYesNo = {
	type: "zones";
	playerId: string;
	choice: boolean;
}

export type PlayerRequestConfirmationOption = {
	type: "zones";
	playerId: string;
	choice: number;
	choiceHint: string;
}