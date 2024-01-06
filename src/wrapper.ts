import { CardProperties, CardType, CardClass } from "./card";
import { Recipe } from "./cards/cook_summon_procedure";
import { PlayerPresences } from "./match_handler";

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

export function createNakamaGameStorageAccess(nakamaAPI: nkruntime.Nakama): GameStorageAccess {
	return {
		readCardProperty(code) {
			// read database
			let queryResult = nakamaAPI.storageRead([
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
			let baseProperties: CardProperties = {
				code,
				name: cardPropertyData.name || "Unknown",
				type: cardPropertyData.type || CardType.UNKNOWN,
				description: cardPropertyData.description || "",
				classes: cardPropertyData.class || CardClass.UNKNOWN,
				grade: cardPropertyData.grade || 0,
				power: cardPropertyData.power || 0,
				health: cardPropertyData.health || 0
			};

			return baseProperties;
		},
		
		readDishCardRecipe(code) {
			// read database
			let queryResult = nakamaAPI.storageRead([
				{
					collection: "system",
					key: "recipes",
					userId: "00000000-0000-0000-0000-000000000000"
				}
			]);
			let recipeListData = (queryResult[0] && queryResult[0].value) || {};
			let recipeData = recipeListData[code];

			if (!recipeData) {
				return null;
				//throw Error("Card with given code does not have a recipe");
			}

			return recipeData;
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