import { CardProperties, CardType, CardClass, CardSchemas } from "./model/cards";
import { EMPTY_RECIPE, Recipe, RecipeSchemas } from "./model/recipes";
import { Deck, DeckSchemas, Decklist, validateDeck } from "./model/decks";
import { PlayerPresences } from "./match_handler";
import zod, { z } from "zod";
import { UUIDUtil, Utility } from "./utility";
import { CardCollection, CardItem, CollectionSchemas } from "./model/player_collections";
import { DecklistConfiguration } from "./constants";
import { PlayerShop, PlayerShops, SHOP_SCHEMAS, ShopItem, ShopSupplier } from "./model/stores";

export interface MatchMessageDispatcher {
	dispatch(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void,
	dispatchDeferred(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void
}

export interface IDGenerator {
	uuid(): string
}

export interface GameStorageAccess {
	readCardProperty(code: number): CardProperties,
	readDishCardRecipe(code: number): Recipe | null,
	readPlayerStarterDecks(): Array<Deck>,
	readPlayerDecklist(playerId: string): Decklist,
	readPlayerDecks(playerId: string): Array<Deck>,
	readPlayerActiveDeck(playerId: string): Deck,
	readPlayerCardCollection(playerId: string): CardCollection,
	addPlayerDeck(playerId: string, deck: Deck): void,
	addCardToPlayerCollection(playerId: string, cards: Array<CardItem>): void,
	updatePlayerDecklist(playerId: string, decklist: Decklist): void,
	updatePlayerDeck(playerId: string, deck: Deck): void,
	updatePlayerCardCollections(playerId: string, collection: CardCollection): void,
	setPlayerActiveDeck(playerId: string, deckId: string): void,
	deletePlayerDeck(playerId: string, deckId: string): void
	readPlayerCoin(playerId: string): number,
	givePlayerCoin(playerId: string, amount: number): void,
	takePlayerCoin(playerId: string, amount: number): void,
	readPlayerShopSupplier(): ShopSupplier,
	updatePlayerShopSupplier(supplier: ShopSupplier): void,
	readPlayerShop(playerId: string): PlayerShop,
	updatePlayerShop(playerId: string, shop: PlayerShop): void
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

export function createSequentialIDGenerator(initialId: number = 1): IDGenerator {
	let nextId: number = initialId;
	return {
		uuid() {
			let resultId = nextId;
			nextId += 1;
			return resultId.toString();
		}
	}
}

export type NakamaMatchDispatcherCreateOptions = {
	nk: nkruntime.Nakama,
	logger?: nkruntime.Logger,
	dispatcher: nkruntime.MatchDispatcher,
	presences: PlayerPresences
}


export type NakamaGameStorageAccessCreateOptions = {
	nk: nkruntime.Nakama,
	logger?: nkruntime.Logger
}

export function createNakamaGameStorageAccess(options: NakamaGameStorageAccessCreateOptions): GameStorageAccess {
	return NakamaAdapter.storageAccess(options);
}

export namespace NakamaAdapter {

	export function matchDispatcher(options: NakamaMatchDispatcherCreateOptions): MatchMessageDispatcher {
		return {
			dispatch(code, message, destinationPlayerIds, senderId, reliable) {
				let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => options.presences[id]!)) || undefined;
				let senderPresences = (senderId && options.presences[senderId]) || undefined;
				options.dispatcher.broadcastMessage(code, message, destinationPresences, senderPresences, reliable);
			},
	
			dispatchDeferred(code, message, destinationPlayerIds, senderId, reliable) {
				let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => options.presences[id]!)) || undefined;
				let senderPresences = (senderId && options.presences[senderId]) || undefined;
				options.dispatcher.broadcastMessageDeferred(code, message, destinationPresences, senderPresences, reliable);
			},
	
		};
	}

	// create wrapper class for accessing game storage (or database)
	export function storageAccess(options: NakamaGameStorageAccessCreateOptions): GameStorageAccess {
		
		const SYSTEM_COLLECTION = "system"
		const PLAYER_COLLECTION = "players"
		const CARDS_KEY = "cards"
		const RECIPES_KEY = "recipes"
		const STARTER_DECKS_KEY = "starter_decks"
		const DECKLIST_KEY = "decklist"
		const COLLECTION_KEY = "collection"
		const SHOP_SUPPLIER_KEY = "shop_supplier"
		const SHOP_KEY = "shop"
		const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

		return {
			readCardProperty(code) {
				// read database
				let queryResult = options.nk.storageRead([
					{
						collection: SYSTEM_COLLECTION,
						key: CARDS_KEY,
						userId: SYSTEM_USER_ID
					}
				]);
				let cardData = (queryResult[0] && queryResult[0].value) || {};
				let cardPropertyData = cardData[code];
				if (!cardPropertyData) {
					throw new Error(`No card properties exists for card with code: ${code}`);
				}
				let parseResult = CardSchemas.CARD.safeParse(cardPropertyData);
				if (!parseResult.success) {
					throw new Error(`Invalid card properties fopr card id: ${code}, ${parseResult.error.message}`);
				}
				let parsed = parseResult.data;
				let baseProperties: CardProperties = {
					code,
					type: parsed.type || CardType.UNKNOWN,
					classes: parsed.classes || CardClass.UNKNOWN,
					grade: parsed.grade || 0,
					power: parsed.power || 0,
					health: parsed.health || 0,
					bonusPower: parsed.bonusPower || 0,
					bonusHealth: parsed.bonusHealth || 0
				};
	
				return baseProperties;
			},
			
			readDishCardRecipe(code) {
				// read database
				let queryResult = options.nk.storageRead([
					{
						collection: SYSTEM_COLLECTION,
						key: RECIPES_KEY,
						userId: SYSTEM_USER_ID
					}
				]);
				let recipeListData = (queryResult[0] && queryResult[0].value) || {};
				let recipeData = recipeListData[code];
				let parseResult = RecipeSchemas.RECIPE.safeParse(recipeData);
				if (!parseResult.success) {
					options.logger?.error(`Invalid recipe for card id %s: %s`, code, parseResult.error.message);
					return EMPTY_RECIPE;
				}
				let parsed = parseResult.data;
				let recipe: Recipe = parsed;
				return recipe;
			},
	
			readPlayerStarterDecks() {
				// read database
				let queryResult = options.nk.storageRead([
					{
						collection: SYSTEM_COLLECTION,
						key: STARTER_DECKS_KEY,
						userId: SYSTEM_USER_ID
					}
				]);
				let rawData = (queryResult[0] && queryResult[0].value);
				let parseResult = DeckSchemas.DECK_PRESETS.safeParse(rawData);
				if (!parseResult.success) {
					options.logger?.error(`Invalid starter decks data: %s`, parseResult.error.message);
					return [];
				}
				let starterDeck: Array<Deck> = []
				for (let deckData of parseResult.data.decks) {
					let deckEntry: Deck = {
						id: options.nk.uuidv4(),
						name: deckData.name,
						main: [],
						recipe: []
					}
					for (let cardData of deckData.main) {
						for (let i=0; i<cardData.count; i++) {
							deckEntry.main.push({ id: options.nk.uuidv4(), code: cardData.code })
						}
					}
					for (let cardData of deckData.recipe) {
						for (let i=0; i<cardData.count; i++) {
							deckEntry.recipe.push({ id: options.nk.uuidv4(), code: cardData.code })
						}
					}
					deckEntry.valid = validateDeck(deckEntry).valid;
					starterDeck.push(deckEntry);
				}
				return starterDeck;
			},
			
			readPlayerDecklist(playerId: string) {
				let queryResult = options.nk.storageRead([
					{
						collection: PLAYER_COLLECTION,
						key: DECKLIST_KEY,
						userId: playerId
					}
				]);

				let playerCollection = this.readPlayerCardCollection(playerId);

				let rawData = (queryResult[0] && queryResult[0].value);
				//options.logger?.debug(JSON.stringify(queryResult))
				
				// if empty, initialize new deck for player
				if (!rawData) {
					// get a random starter deck to player
					let starterDecks = this.readPlayerStarterDecks();
					Utility.shuffle(starterDecks);
					let obtainedDeck: Deck = starterDecks[0];
					// create new player data
					let newDecklist: Decklist = {
						decks: [ obtainedDeck ],
						activeIndex: 0
					}
					// add cards from starter deck to player collection
					playerCollection.cards = playerCollection.cards.concat(obtainedDeck.main);
					playerCollection.cards = playerCollection.cards.concat(obtainedDeck.recipe);
					this.updatePlayerCardCollections(playerId, playerCollection);
					this.updatePlayerDecklist(playerId, newDecklist);
					return newDecklist;
				}
	
				let parseResult = DeckSchemas.DECKLIST.safeParse(rawData);
				// missing data or invalid data
				if (!parseResult.success) {
					throw new Error(`Invalid player decks data: ${parseResult.error.message}`)
				}

				let decklist: Decklist = { decks: [], activeIndex: parseResult.data.activeIndex };
				for (let deckData of parseResult.data.decks) {
					let deck: Deck = { id: deckData.id, name: deckData.name, main: [], recipe: [] }

					for (let cardData of deckData.main) {
						let card: CardItem | undefined = undefined;
						if (typeof(cardData) === "string") {
							card = playerCollection.cards.find(c => c.id === cardData)
						}
						else if (typeof(cardData) === "object") {
							let id = cardData.id
							let code = cardData.code
							card = playerCollection.cards.find(c => c.id === id)
							if (!card) {
								card = playerCollection.cards.find(c => (c.code === code) && deck.main.every(c2 => c2.id !== c.id));
							}
						}

						if (card) {
							deck.main.push(card);
						}
					}

					for (let cardData of deckData.recipe) {
						let card: CardItem | undefined = undefined;
						if (typeof(cardData) === "string") {
							card = playerCollection.cards.find(c => c.id === cardData)
						}
						else if (typeof(cardData) === "object") {
							let id = cardData.id
							let code = cardData.code
							card = playerCollection.cards.find(c => c.id === id)
							if (!card) {
								card = playerCollection.cards.find(c => (c.code === code) && deck.recipe.every(c2 => c2.id !== c.id));
							}
						}

						if (card) {
							deck.recipe.push(card);
						}
					}
					
					decklist.decks.push(deck);
				}
				
				// revalidate deck for unverified deck
				let hasUnverifiedDeck = false;
				for (let deck of decklist.decks) {
					if (deck.valid === undefined) {
						deck.valid = validateDeck(deck).valid;
						hasUnverifiedDeck = true;
					}
				}
				if (hasUnverifiedDeck) {
					options.nk.storageWrite([
						{
							collection: PLAYER_COLLECTION,
							key: DECKLIST_KEY,
							userId: playerId,
							value: decklist,
							permissionRead: 2,
							permissionWrite: 1
						}
					]);
				}
	
				return decklist;
			},

			readPlayerDecks(playerId: string) {
				return this.readPlayerDecklist(playerId).decks;
			},
	
			readPlayerActiveDeck(playerId) {
				let decklist = this.readPlayerDecklist(playerId);
				return decklist.decks[decklist.activeIndex];
			},
	
			readPlayerCardCollection(playerId) {
				let queryResult = options.nk.storageRead([
					{
						collection: PLAYER_COLLECTION,
						key: COLLECTION_KEY,
						userId: playerId
					}
				]);
				let rawData = (queryResult[0] && queryResult[0].value);
				//options.logger?.debug(JSON.stringify(queryResult))
				
				// if empty, create new collection for player (may add a free default card here (not cards from starter deck))
				if (!rawData) {
					let newCollection: CardCollection = { cards: [] }
					this.updatePlayerCardCollections(playerId, newCollection);
					return newCollection;
				}
				let parseResult = CollectionSchemas.COLLECTION.safeParse(rawData);
				if (!parseResult.success) {
					throw new Error(`Invalid player collection data: ${parseResult.error.message}`)
				}

				return parseResult.data;
			},

			addPlayerDeck(playerId, deck) {
				let decklist = this.readPlayerDecklist(playerId);
				if (decklist.decks.length >= DecklistConfiguration.maxDeckCount) {
					throw new Error(`Player reaches maximum deck count!`)
				}
				deck.valid = validateDeck(deck).valid;

				decklist.decks.push(deck);
				this.updatePlayerDecklist(playerId, decklist);
			},

			addCardToPlayerCollection(playerId, cards) {
				let collection = this.readPlayerCardCollection(playerId);
				let lastIndex = parseFloat(collection.cards.at(-1)?.id || "0") + 1;
				cards.forEach((card, index) => card.id = (lastIndex + index).toString());
				collection.cards = collection.cards.concat(cards);
				this.updatePlayerCardCollections(playerId, collection);
			},
	
			updatePlayerDecklist(playerId, decklist) {
				let decklistData: z.infer<typeof DeckSchemas.DECKLIST> = {
					decks: [],
					activeIndex: decklist.activeIndex
				};
				for (let deck of decklist.decks) {
					decklistData.decks.push({
						id: deck.id,
						name: deck.name,
						main: deck.main.map(card => card.id),
						recipe: deck.recipe.map(card => card.id)
					})
				}
				options.nk.storageWrite([
					{
						collection: PLAYER_COLLECTION,
						key: DECKLIST_KEY,
						userId: playerId,
						value: decklistData,
						permissionRead: 2,
						permissionWrite: 1
					}
				]);
			},

			updatePlayerDeck(playerId, deck) {
				let decklist: Decklist = this.readPlayerDecklist(playerId)
				let oldDeckIndex = decklist.decks.findIndex(existingDeck => existingDeck.id === deck.id);
				if (oldDeckIndex < 0) {
					throw new Error(`Player try to edit a deck that does not exist!`)
				}

				deck.valid = validateDeck(deck).valid;
				decklist.decks[oldDeckIndex] = deck;
				this.updatePlayerDecklist(playerId, decklist);
			},

			updatePlayerCardCollections(playerId, collection) {
				options.nk.storageWrite([
					{
						collection: PLAYER_COLLECTION,
						key: COLLECTION_KEY,
						userId: playerId,
						value: collection,
						permissionRead: 2,
						permissionWrite: 0
					}
				])
			},

			setPlayerActiveDeck(playerId, deckId) {
				let decklist = this.readPlayerDecklist(playerId);
				let newActiveDeckIndex = decklist.decks.findIndex(deck => deck.id === deckId);
				if (newActiveDeckIndex < 0) {
					throw new Error("Player has no deck with specified id!");
				}

				decklist.activeIndex = newActiveDeckIndex;
				this.updatePlayerDecklist(playerId, decklist);
	
			},
	
			deletePlayerDeck(playerId, deckId) {
				let decklist = this.readPlayerDecklist(playerId);
				let deletedDeckIndex = decklist.decks.findIndex(deck => deck.id === deckId);
				if (deletedDeckIndex < 0) {
					throw new Error("Player has no deck with specified id!");
				}
			
				decklist.decks = decklist.decks.filter(deck => deck.id !== deckId);
				// Automatically select first remaining deck when delete the active deck
				if (deletedDeckIndex === decklist.activeIndex) {
					decklist.activeIndex = 0;
				}
				this.updatePlayerDecklist(playerId, decklist);

			},
			
			readPlayerCoin(playerId: string): number {
				let account = options.nk.accountGetId(playerId);
				return account.wallet["coin"] || 0;
			},

			givePlayerCoin(playerId: string, amount: number): void {
				options.nk.walletUpdate(playerId, { coin: amount });
			},

			takePlayerCoin(playerId: string, amount: number): void {
				options.nk.walletUpdate(playerId, { coin: -amount });
			},

			readPlayerShopSupplier() {
				let results = options.nk.storageRead([{
					collection: SYSTEM_COLLECTION,
					key: SHOP_SUPPLIER_KEY,
					userId: SYSTEM_USER_ID
				}]);

				// default
				if (!results[0]) {
					let defaultSupplier: ShopSupplier = {
						stocks: []
					};
					this.updatePlayerShopSupplier(defaultSupplier);
					return defaultSupplier;
				}
				let parseResult = SHOP_SCHEMAS.SHOP_SUPPLIER.safeParse(results[0].value);
				if (!parseResult.success) {
					throw new Error("Shop supplier in database invalid or corrupted!");
				}

				return parseResult.data;
			},

			updatePlayerShopSupplier(supplier) {
				// filter out every supplier that is expired by the moment
				let updateTime = Date.now()
				supplier.stocks = supplier.stocks.filter(s => !PlayerShops.isSupplierExpired(s, updateTime))
				options.nk.storageWrite([{
					collection: SYSTEM_COLLECTION,
					key: SHOP_SUPPLIER_KEY,
					userId: SYSTEM_USER_ID,
					value: supplier,
					permissionRead: 2,
					permissionWrite: 0
				}]);
			},

			readPlayerShop(playerId): PlayerShop {
				let supplier = this.readPlayerShopSupplier();
				let results = options.nk.storageRead([{
					collection: PLAYER_COLLECTION,
					key: SHOP_KEY,
					userId: playerId
				}]);

				let shop: PlayerShop

				// initialize shop
				if (!results[0]) {
					shop = PlayerShops.supplyNewShop(supplier);
				} else {
					let parseResult = SHOP_SCHEMAS.SHOP.safeParse(results[0].value);
					if (!parseResult.success) {
						throw new Error("Shop in database invalid or corrupted!");
					}

					shop = PlayerShops.refreshShop(parseResult.data, supplier);
				}

				// update refreshed shop
				options.logger?.debug("player shop is %s", JSON.stringify(shop))
				this.updatePlayerShop(playerId, shop);
				return shop;
			},

			updatePlayerShop(playerId, shop) {
				options.nk.storageWrite([{
					collection: PLAYER_COLLECTION,
					key: SHOP_KEY,
					userId: playerId,
					value: shop,
					permissionRead: 2,
					permissionWrite: 0
				}]);
			}
		}
	}
}

// function createNakamaStorageAccess(nk: nkruntime.Nakama): StorageAccess {
// 	nk.storageWrite
// 	nk.storageRead
// 	nk.storageDelete
// 	return {

// 	};
// }