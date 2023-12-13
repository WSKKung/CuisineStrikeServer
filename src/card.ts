// Should be stored as a bitmask
enum CardType {
	UNKNOWN = 0b0,
	DISH = 0b1,
	INGREDIENT = 0b10,
	ACTION = 0b100,
	TRIGGER = 0b1000,
	CUSTOMER = 0b10000,
	INGREDIENT_DISH = 0b11, // DISH + INGREDIENT
}

// Should be stored as a bitmask
enum CardClass {
	UNKNOWN = 0b0,
}

interface CardProperties {
	code: number,
	name: string,
	type: CardType,
	description: string,
	classes: CardClass
	grade: number,
	power: number,
	health: number,
}

interface Card {
	id: string,
	base_properties: CardProperties,
	properties: CardProperties,
	zone?: CardZone
}

namespace Card {

	function loadCardBaseProperties(code: number, nk: nkruntime.Nakama): CardProperties {
		// load from cache
		let cardPropertiesCache = nk.localcacheGet("cardProperties") || {};
		// read database
		// nk.storageRead([
		// 	{
		// 		collection: "cards",
		// 		key: code.toString(),
		// 		userId: "00000000-0000-0000-0000-000000000000"
		// 	}
		// ])
		let queryResult = nk.storageRead([
			{
				collection: "cards",
				key: code.toString(),
				userId: "00000000-0000-0000-0000-000000000000"
			}
		]);
		let cardData = (queryResult[0] && queryResult[0].value) || {};
		let baseProperties: CardProperties = cardPropertiesCache[code] || {
			code,
			name: cardData.name || "Unknown",
			type: cardData.type || CardType.UNKNOWN,
			description: cardData.description || "",
			classes: cardData.class || CardClass.UNKNOWN,
			grade: cardData.grade || 0,
			power: cardData.power || 0,
			health: cardData.health || 0
		};
		cardPropertiesCache[code] = baseProperties;
		nk.localcachePut("cardProperties", cardPropertiesCache);
		return baseProperties;
	}


	export function create(id: string, code: number, nk: nkruntime.Nakama): Card {
		// load card base properties from code
		let base_properties: CardProperties = loadCardBaseProperties(code, nk);
		// create instance property
		// hardcoded cloning because nakama runtime does not like object destructuring (due to global instance modification prevention, sadge)
		let properties: CardProperties = {
			code,
			name: base_properties.name,
			type: base_properties.type,
			description: base_properties.description,
			classes: base_properties.classes,
			grade: base_properties.grade,
			power: base_properties.power,
			health: base_properties.health
		};
		// create card instance
		let card: Card = {
			id: id,
			base_properties,
			properties
		};
		return card;
	}

	export function getCode(card: Card): number {
		return card.properties.code;
	}

	export function getType(card: Card): CardType {
		return card.properties.type;
	}

	export function getName(card: Card): string {
		return card.properties.name;
	}

	export function getDescription(card: Card): string {
		return card.properties.name;
	}

	export function getClass(card: Card): CardClass {
		return card.properties.classes;
	}

	export function getGrade(card: Card): number {
		return card.properties.grade;
	}
	
	export function getPower(card: Card): number {
		return card.properties.power;
	}

	export function getHealth(card: Card): number {
		return card.properties.health;
	}

	export function getBaseGrade(card: Card): number {
		return card.base_properties.grade;
	}
	
	export function getBasePower(card: Card): number {
		return card.base_properties.power;
	}

	export function getBaseHealth(card: Card): number {
		return card.base_properties.health;
	}

	export function getBonusGrade(card: Card): number {
		return Math.max(getGrade(card) - getBaseGrade(card), 0);
	}

	export function getLocation(card: Card): CardLocation {
		return card.zone ? card.zone.location : CardLocation.VOID;
	}

	export function getColumn(card: Card): number {
		return card.zone ? card.zone.column : 0;
	}

	export function hasType(card: Card, type: CardType): boolean {
		return (getType(card) & type) === type;
	}
	
	export function hasClass(card: Card, c_class: CardClass): boolean {
		return (getClass(card) & c_class) === c_class;
	}

	export function setGrade(card: Card, amount: number): void {
		card.properties.grade = amount;
	}
	
	export function setPower(card: Card, amount: number): void {
		card.properties.power = amount;
	}

	export function setHealth(card: Card, amount: number): void {
		card.properties.health = amount;
	}


}