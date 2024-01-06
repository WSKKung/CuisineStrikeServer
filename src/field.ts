import { CardLocation } from "./card";
import { CardID } from "./card";

export interface CardZone {
	location: CardLocation,
	column: number,
	cards: Array<CardID>
}

export namespace Field {
	export function createZone(location: CardLocation, column?: number): CardZone {
		let newZone: CardZone = {
			location,
			column: column || 0,
			cards: []
		}
		return newZone;
	}
}