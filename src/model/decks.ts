import { DeckConfiguration } from "../constants"
import { CardItem } from "./player_collections"
import { ArrayUtil } from "../utility"
import { z } from "zod"

export type Deck = {
	id: string,
	name: String,
	main: Array<CardItem>,
	recipe: Array<CardItem>
}

export type DeckPresetItem = {
	code: number,
	count: number
}

export type DeckPreset = {
	name: String,
	main: Array<DeckPresetItem>,
	recipe: Array<DeckPresetItem>
}

export type Decklist = {
	decks: Array<Deck>,
	activeIndex: number
}

export const DeckSchemas = {
	DECK: z.custom<Deck>(),
	DECK_PRESET: z.custom<DeckPreset>(),
	DECK_PRESETS: z.object({ decks: z.array(z.custom<DeckPreset>()) }),
	DECKLIST: z.custom<Decklist>()
}

export type DeckValidationResult = {
	valid: true
} | {
	valid: false,
	reason: string
}

export function validateDeck(deck: Deck): DeckValidationResult {
	let mainSize = deck.main.length;
	if (mainSize < DeckConfiguration.mainSize.min || mainSize > DeckConfiguration.mainSize.max) {
		return { valid: false, reason: "MAIN_DECK_INVALID_SIZE" }
	}

	let recipeSize = deck.recipe.length;
	if (recipeSize < DeckConfiguration.recipeSize.min || recipeSize > DeckConfiguration.recipeSize.max) {
		return { valid: false, reason: "RECIPE_DECK_INVALID_SIZE" }
	}

	let mainUniqueCardCodes = ArrayUtil.countUnique(deck.main, card => card.code);
	if (mainUniqueCardCodes.some(card => card.count > DeckConfiguration.maxDuplicates)) {
		return { valid: false, reason: "MAIN_DECK_TOO_MANY_DUPLICATES" }
	}

	let recipeUniqueCardCodes = ArrayUtil.countUnique(deck.recipe, card => card.code);
	if (recipeUniqueCardCodes.some(card => card.count > DeckConfiguration.maxDuplicates)) {
		return { valid: false, reason: "RECIPE_DECK_TOO_MANY_DUPLICATES" }
	}

	return { valid: true }
}