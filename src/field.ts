import { CardLocation } from "./model/cards";
import { CardID } from "./model/cards";

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