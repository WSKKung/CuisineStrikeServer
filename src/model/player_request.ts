import { Card } from "./cards";
import { CardZone } from "./field";

export type PlayerChoiceType = PlayerChoiceRequest["type"] & PlayerChoiceResponse["type"];
export type PlayerChoiceResponseValue<Type extends PlayerChoiceType> = (PlayerChoiceResponse & {type: Type})["choice"];

export type PlayerChoiceRequest = PlayerChoiceRequestZones | PlayerChoiceRequestCards | PlayerChoiceRequestYesNo | PlayerChoiceRequestOption;

export type PlayerChoiceRequestZones = {
	type: "zones";
	playerId: string;
	hint: string;
	min: number;
	max: number;
	zones: Array<CardZone>;
	callback: (chosenZones: Array<CardZone>) => void;
};

export type PlayerChoiceRequestCards = {
	type: "cards";
	playerId: string;
	hint: string;
	min: number;
	max: number;
	cards: Array<Card>;
	callback: (chosenCards: Array<Card>) => void;
};

export type PlayerChoiceRequestYesNo = {
	type: "yes_no";
	playerId: string;
	hint: string;
	callback: (choice: boolean) => void;
};

export type PlayerChoiceRequestOption = {
	type: "option";
	playerId: string;
	hint: string;
	options: Array<string>;
	callback: (choice: number) => void;
};

export type PlayerChoiceResponse = PlayerChoiceResponseZones | PlayerChoiceResponseCards | PlayerChoiceResponseYesNo | PlayerChoiceResponseOption;

export type PlayerChoiceResponseZones = {
	type: "zones";
	playerId: string;
	hint: string;
	choice: Array<CardZone>;
}

export type PlayerChoiceResponseCards = {
	type: "cards";
	playerId: string;
	hint: string;
	choice: Array<Card>;
}

export type PlayerChoiceResponseYesNo = {
	type: "yes_no";
	playerId: string;
	hint: string;
	choice: boolean;
}

export type PlayerChoiceResponseOption = {
	type: "option";
	playerId: string;
	hint: string;
	choice: number;
}