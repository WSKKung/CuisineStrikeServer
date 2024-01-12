import { CardProperties, CardType, CardClass } from "./card";
import { Recipe } from "./cards/cook_summon_procedure";
import { PlayerPresences } from "./match_handler";
import zod from "zod";

export interface MatchMessageDispatcher {
	dispatch(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void,
	dispatchDeferred(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void
}

export interface IDGenerator {
	uuid(): string
}

export interface GameStorageAccess {
	readCardProperty(code: number): CardProperties,
	readDishCardRecipe(code: number): Recipe | null
}

export function createNakamaMatchDispatcher(nakamaDispatcher: nkruntime.MatchDispatcher, presences: PlayerPresences): MatchMessageDispatcher {
	return {

		dispatch(code, message, destinationPlayerIds, senderId, reliable) {
			let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => presences[id]!)) || undefined;
			let senderPresences = (senderId && presences[senderId]) || undefined;
			nakamaDispatcher.broadcastMessage(code, message, destinationPresences, senderPresences, reliable);
		},

		dispatchDeferred(code, message, destinationPlayerIds, senderId, reliable) {
			let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => presences[id]!)) || undefined;
			let senderPresences = (senderId && presences[senderId]) || undefined;
			nakamaDispatcher.broadcastMessageDeferred(code, message, destinationPresences, senderPresences, reliable);
		},

	};
}

export function createNakamaIDGenerator(nakamaAPI: nkruntime.Nakama): IDGenerator {
	return {
		uuid() {
			return nakamaAPI.uuidv4();
		}
	}
}

export function createNakamaGameStorageAccess(nk: nkruntime.Nakama, logger: nkruntime.Logger): GameStorageAccess {

	const storageDataSchemas = {
		recipe: zod.custom<Recipe>(),
		cardProperties: zod.object({
			name: zod.string(),
			description: zod.string(),
			type: zod.number().int().min(0),
			grade: zod.number().int().min(0).optional(),
			classes: zod.number().int().min(0).optional(),
			power: zod.number().int().min(0).optional(),
			health: zod.number().int().min(0).optional(),
			bonus_power: zod.number().int().min(0).optional(),
			bonus_health: zod.number().int().min(0).optional()
		})
	}

	return {
		readCardProperty(code) {
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
			let parseResult = storageDataSchemas.cardProperties.safeParse(cardPropertyData);
			if (!parseResult.success) {
				throw Error(`Invalid card properties fopr card id: ${code}, ${parseResult.error.message}`);
			}
			let parsed = parseResult.data;
			let baseProperties: CardProperties = {
				code,
				name: parsed.name || "Unknown",
				description: parsed.description || "",
				type: parsed.type || CardType.UNKNOWN,
				classes: parsed.classes || CardClass.UNKNOWN,
				grade: parsed.grade || 0,
				power: parsed.power || 0,
				health: parsed.health || 0,
				bonusPower: parsed.bonus_power || 0,
				bonusHealth: parsed.bonus_health || 0
			};

			return baseProperties;
		},
		
		readDishCardRecipe(code) {
			// read database
			let queryResult = nk.storageRead([
				{
					collection: "system",
					key: "recipes",
					userId: "00000000-0000-0000-0000-000000000000"
				}
			]);
			let recipeListData = (queryResult[0] && queryResult[0].value) || {};
			let recipeData = recipeListData[code];
			let parseResult = storageDataSchemas.recipe.safeParse(recipeData);
			if (!parseResult.success) {
				logger.error(`Invalid recipe for card id %s: %s`, code, parseResult.error.message);
				return null;
			}
			let parsed = parseResult.data;
			let recipe: Recipe = parsed;
			return recipe;
		},
	}
}

// function createNakamaStorageAccess(nk: nkruntime.Nakama): StorageAccess {
// 	nk.storageWrite
// 	nk.storageRead
// 	nk.storageDelete
// 	return {

// 	};
// }