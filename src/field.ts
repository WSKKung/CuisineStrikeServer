// Should be used as bitmask
enum CardLocation {
	VOID = 0b0,
	HAND = 0b1,
	MAIN_DECK = 0b10,
	RECIPE_DECK = 0b100,
	SERVE_ZONE = 0b1000,
	STANDBY_ZONE = 0b10000,
	TRASH = 0b100000
}

interface CardZone {
	location: CardLocation,
	column: number,
	cards: Array<Card>
}

namespace Field {
	export function createZone(location: CardLocation, column?: number): CardZone {
		let newZone: CardZone = {
			location,
			column: column || 0,
			cards: []
		}
		return newZone;
	}
}