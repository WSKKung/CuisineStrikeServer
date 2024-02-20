import { CardLocation } from "./model/cards";
import { CardID } from "./model/cards";

export interface CardZone {
	owner: string,
	location: CardLocation,
	column: number,
	cards: Array<CardID>
}

export namespace Field {
	export function createZone(ownerId: string, location: CardLocation, column?: number): CardZone {
		let newZone: CardZone = {
			owner: ownerId,
			location,
			column: column || 0,
			cards: []
		}
		return newZone;
	}
}