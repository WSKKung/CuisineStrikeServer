import { CardZone } from "./field";
import { Utility } from "./utility";

export type CardID = string;

// Should be stored as a bitmask
export enum CardType {
	UNKNOWN = 0b0,
	DISH = 0b1,
	INGREDIENT = 0b10,
	ACTION = 0b100,
	TRIGGER = 0b1000,
	CUSTOMER = 0b10000,
	INGREDIENT_DISH = 0b11, // DISH + INGREDIENT
}

// Should be used as bitmask
export enum CardLocation {
	VOID = 0,
	HAND = 1,
	MAIN_DECK = 2,
	RECIPE_DECK = 4,
	SERVE_ZONE = 8,
	STANDBY_ZONE = 16,
	TRASH = 32,
	ANYWHERE = HAND | MAIN_DECK | RECIPE_DECK | SERVE_ZONE | STANDBY_ZONE | TRASH
}

// Should be stored as a bitmask
export enum CardClass {
	UNKNOWN = 0b0,
	GRAIN = 0b1,
	MEAT = 0b10,
	BREAD = 0b100
}

export interface CardProperties {
	code: number,
	name: string,
	type: CardType,
	description: string,
	classes: CardClass
	grade: number,
	power: number,
	health: number,
}

export interface Card {
	id: CardID,
	owner: string,
	base_properties: CardProperties,
	properties: CardProperties,
	zone?: CardZone,
	location: CardLocation,
	column: number
}

export namespace Card {

	export function loadCardBaseProperties(code: number, nk: nkruntime.Nakama): CardProperties {
		// load from cache
		let cardPropertiesCache = nk.localcacheGet("cardProperties") || {};
		// read database
		let queryResult = nk.storageRead([
			{
				collection: "system",
				key: "cards",
				userId: "00000000-0000-0000-0000-000000000000"
			}
		]);
		let cardData = (queryResult[0] && queryResult[0].value) || {};
		let cardPropertyData = cardData[code];
		if (!cardPropertyData) {
			throw Error(`No card properties exists for card with code: ${code}`);
		}
		let baseProperties: CardProperties = cardPropertiesCache[code] || {
			code,
			name: cardPropertyData.name || "Unknown",
			type: cardPropertyData.type || CardType.UNKNOWN,
			description: cardPropertyData.description || "",
			classes: cardPropertyData.class || CardClass.UNKNOWN,
			grade: cardPropertyData.grade || 0,
			power: cardPropertyData.power || 0,
			health: cardPropertyData.health || 0
		};
		cardPropertiesCache[code] = baseProperties;
		nk.localcachePut("cardProperties", cardPropertiesCache);
		return baseProperties;
	}


	export function create(id: CardID, code: number, owner: string, baseProperties: CardProperties): Card {
		// create instance property
		let properties: CardProperties = Utility.shallowClone(baseProperties);
		// create card instance
		let card: Card = {
			id: id,
			owner: owner,
			base_properties: baseProperties,
			properties,
			location: CardLocation.VOID,
			column: 0
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
		return card.location;
	}

	export function getColumn(card: Card): number {
		return card.column;
	}

	export function getOwner(card: Card): string {
		return card.owner;
	}

	export function hasType(card: Card, type: CardType): boolean {
		return Utility.bitMaskIntersects(getType(card), type);
	}
	
	export function hasClass(card: Card, c_class: CardClass): boolean {
		return Utility.bitMaskIntersects(getClass(card), c_class);
	}

	export function setGrade(card: Card, amount: number): void {
		card.properties.grade = amount;
	}
	
	export function setPower(card: Card, amount: number): void {
		card.properties.power = amount;
	}

	export function setHealth(card: Card, amount: number): void {
		if (amount < 0) amount = 0;
		card.properties.health = amount;
	}

	export function hasLocation(card: Card, location: CardLocation): boolean {
		return (getLocation(card) & location) > 0;
	}

	export function isAbleToSetAsIngredient(card: Card): boolean {
		if (getType(card) === CardType.INGREDIENT_DISH) {
			return hasLocation(card, CardLocation.SERVE_ZONE);
		}
		else return hasType(card, CardType.INGREDIENT) && hasLocation(card, CardLocation.HAND);
	}

	export function getIngredientMinimumMaterialCost(card: Card): number {
		return Card.getType(card) === CardType.INGREDIENT_DISH ? 0 : getBaseGrade(card) - 1
	}

}

