import { DeckConfiguration } from "../constants"
import { CardItem } from "./player_collections"
import { ArrayUtil } from "../utility"
import { z } from "zod"

export type Deck = {
	id: string,
	name: string,
	main: Array<CardItem>,
	recipe: Array<CardItem>,
	valid?: boolean
}

export type DeckPresetItem = {
	code: number,
	count: number
}

export type DeckPreset = {
	name: string,
	main: Array<DeckPresetItem>,
	recipe: Array<DeckPresetItem>
}

export type Decklist = {
	decks: Array<Deck>,
	activeIndex: number
}

export const DeckSchemas = {
	DECK: z.object({
		id: z.string(),
		name: z.string(),
		main: z.array(z.string()),
		recipe: z.array(z.string())
	}),
	DECK_PRESET: z.custom<DeckPreset>(),
	DECK_PRESETS: z.object({ decks: z.array(z.custom<DeckPreset>()) }),
	DECKLIST: z.object({
		decks: z.array(z.object({
			id: z.string(),
			name: z.string(),
			main: z.array(z.union([z.string(), z.custom<CardItem>()])),
			recipe: z.array(z.union([z.string(), z.custom<CardItem>()]))
		})),
		activeIndex: z.number().int()
	})
}

export type DeckValidationResult = {
	valid: true
} | {
	valid: false,
	reasons: Array<string>
}

export function validateDeck(deck: Deck): DeckValidationResult {
	let mainSize = deck.main.length;
	let invalidReasons: Array<string> = []
	if (mainSize < DeckConfiguration.mainSize.min || mainSize > DeckConfiguration.mainSize.max) {
		invalidReasons.push("MAIN_DECK_INVALID_SIZE");
	}

	let recipeSize = deck.recipe.length;
	if (recipeSize < DeckConfiguration.recipeSize.min || recipeSize > DeckConfiguration.recipeSize.max) {
		invalidReasons.push("RECIPE_DECK_INVALID_SIZE");
	}

	let mainUniqueCardCodes = ArrayUtil.countUnique(deck.main, card => card.code);
	if (mainUniqueCardCodes.some(card => card.count > DeckConfiguration.maxDuplicates)) {
		invalidReasons.push("MAIN_DECK_TOO_MANY_DUPLICATES");
	}

	let recipeUniqueCardCodes = ArrayUtil.countUnique(deck.recipe, card => card.code);
	if (recipeUniqueCardCodes.some(card => card.count > DeckConfiguration.maxDuplicates)) {
		invalidReasons.push("RECIPE_DECK_TOO_MANY_DUPLICATES");
	}

	return { valid: invalidReasons.length <= 0, reasons: invalidReasons }
}