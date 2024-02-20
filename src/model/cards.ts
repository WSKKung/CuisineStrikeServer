import { z } from "zod";
import { BitField, Utility } from "../utility";
import { CamelKeysToSnake } from "../utility/types";

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
	ON_FIELD = SERVE_ZONE | STANDBY_ZONE,
	ANYWHERE = HAND | MAIN_DECK | RECIPE_DECK | SERVE_ZONE | STANDBY_ZONE | TRASH
}

// Should be stored as a bitmask
export enum CardClass {
	UNKNOWN = 0b0,
	GRAIN = 0b1,
	MEAT = 0b10,
	BREAD = 0b100,
	EGG = 0b1000
}

export type CardProperties = {
	code: number,
	name: string,
	type: CardType,
	description: string,
	classes: CardClass
	grade: number,
	power: number,
	health: number,
	bonusPower: number,
	bonusHealth: number
}

export type Card = {
	id: CardID,
	owner: string,
	baseProperties: CardProperties,
	properties: CardProperties,
	location: CardLocation,
	column: number,
	damage: number,
	attacks: number
}

export const CardSchemas = {
	CARD: z.object({
		name: z.string(),
		description: z.string(),
		type: z.number().int().min(0),
		grade: z.number().int().min(0).optional(),
		classes: z.number().int().min(0).optional(),
		power: z.number().int().min(0).optional(),
		health: z.number().int().min(0).optional(),
		bonusPower: z.number().int().min(0).optional(),
		bonusHealth: z.number().int().min(0).optional()
	})
}

export namespace Card {

	export function create(id: CardID, code: number, owner: string, baseProperties: CardProperties): Card {
		// create instance property
		let properties: CardProperties = Utility.shallowClone(baseProperties);
		// create card instance
		let card: Card = {
			id: id,
			owner: owner,
			baseProperties: baseProperties,
			properties,
			location: CardLocation.VOID,
			column: 0,
			damage: 0,
			attacks: 0
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
		return card.baseProperties.grade;
	}
	
	export function getBasePower(card: Card): number {
		return card.baseProperties.power;
	}

	export function getBaseHealth(card: Card): number {
		return card.baseProperties.health;
	}

	export function getBonusPower(card: Card): number {
		return card.baseProperties.bonusPower
	}

	export function getBonusHealth(card: Card): number {
		return card.baseProperties.bonusHealth
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

	export function isSame(card: Card, another: Card): boolean {
		return card.id === another.id;
	}

	export function hasType(card: Card, type: CardType): boolean {
		return BitField.any(getType(card), type);
	}

	export function isType(card: Card, type: CardType): boolean {
		return BitField.all(getType(card), type);
	}
	
	export function hasClass(card: Card, c_class: CardClass): boolean {
		return BitField.any(getClass(card), c_class);
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

	export function hasLocation(card: Card, location: CardLocation): boolean {
		return (getLocation(card) & location) > 0;
	}

	export function isAbleToSetAsIngredient(card: Card): boolean {
		if (getType(card) === CardType.INGREDIENT_DISH) {
			return hasLocation(card, CardLocation.SERVE_ZONE | CardLocation.RECIPE_DECK);
		}
		else return hasType(card, CardType.INGREDIENT) && hasLocation(card, CardLocation.HAND);
	}

	export function getIngredientMinimumMaterialCost(card: Card): number {
		return Card.getType(card) === CardType.INGREDIENT_DISH ? 0 : getBaseGrade(card) - 1
	}

	export function resetProperties(card: Card) {
		card.properties = Utility.shallowClone(card.baseProperties);
	}

	export function canPosibblyActivateEffect(card: Card) {
		switch (Card.getType(card)) {
			case CardType.ACTION:
			case CardType.TRIGGER:
				return Card.hasLocation(card, CardLocation.HAND);
			case CardType.INGREDIENT_DISH:
				return Card.hasLocation(card, CardLocation.SERVE_ZONE | CardLocation.STANDBY_ZONE);
			case CardType.DISH:
				return Card.hasLocation(card, CardLocation.SERVE_ZONE);
			case CardType.INGREDIENT:
				return Card.hasLocation(card, CardLocation.STANDBY_ZONE);
			default:
				return false;
		}
	}

}

