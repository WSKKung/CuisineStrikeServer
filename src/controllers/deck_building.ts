import { z } from "zod";
import { Deck, DeckSchemas, DeckValidationResult, validateDeck } from "../model/decks";
import { NakamaAdapter } from "../wrapper";
import { CardItem } from "../model/player_collections";
import { UUIDUtil } from "../utility";

const RPCSchemas = {
	setActiveDeck: z.object({
		deckId: z.string()
	}),
	addDeck: z.object({
		deck: z.custom<Omit<Deck, "id">>()
	}),
	updateDeck: z.object({
		deck: z.custom<Deck>()
	}),
	createDeck: z.object({
		deck: z.custom<{
			name: string,
			main: Array<string>,
			recipe: Array<string>
		}>()
	}),
	saveDeck: z.object({
		deck: z.custom<{
			id: string,
			name: string,
			main: Array<string>,
			recipe: Array<string>
		}>(),
		create: z.boolean().optional()
	}),
	deleteDeck: z.object({
		deckId: z.string()
	}),
	validateDeck: z.object({
		deck: z.custom<{
			id: string,
			name: string,
			main: Array<string>,
			recipe: Array<string>
		}>()
	})
}

export const getDecklistRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let decklist = storage.readPlayerDecklist(ctx.userId);

	return JSON.stringify(decklist);
}

export const addDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let payloadParseResult = RPCSchemas.addDeck.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let newDeck: Deck = {
		id: nk.uuidv4(),
		main: args.deck.main,
		recipe: args.deck.recipe,
		name: args.deck.name
	}
	storage.addPlayerDeck(ctx.userId, newDeck);
	return JSON.stringify({
		success: true,
		id: newDeck.id
	})
}

export const updateDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let payloadParseResult = RPCSchemas.updateDeck.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	storage.updatePlayerDeck(ctx.userId, args.deck);
}

export const saveDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let payloadParseResult = RPCSchemas.saveDeck.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });

	let collection = storage.readPlayerCardCollection(ctx.userId);
	let deck: Deck = { id: args.deck.id, name: args.deck.name, main: [], recipe: [] };


	// get card data from collection and input ids
	for (let cardId of args.deck.main) {
		//cardId = UUIDUtil.base64ToId(cardId);
		let card = collection.cards.find(c => c.id === cardId);
		if (!card) {
			throw new Error("Unknown card")
		}
		deck.main.push(card);
	}

	for (let cardId of args.deck.recipe) {
		//cardId = UUIDUtil.base64ToId(cardId);
		let card = collection.cards.find(c => c.id === cardId);
		if (!card) {
			throw new Error("Unknown card")
		}
		deck.recipe.push(card);
	}

	if (args.create) {
		storage.addPlayerDeck(ctx.userId, deck);
	} else {
		storage.updatePlayerDeck(ctx.userId, deck);
	}

	return JSON.stringify({
		success: true,
		id: deck.id
	});
	
}

export const deleteDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let payloadParseResult = RPCSchemas.deleteDeck.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	storage.deletePlayerDeck(ctx.userId, args.deckId);
}

export const setActiveDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let payloadParseResult = RPCSchemas.setActiveDeck.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	storage.setPlayerActiveDeck(ctx.userId, args.deckId);
	return JSON.stringify({success: true});
}

export const validateDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let payloadParseResult = RPCSchemas.validateDeck.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}
	
	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });

	let collection = storage.readPlayerCardCollection(ctx.userId);
	let deck: Deck = { id: args.deck.id, name: args.deck.name, main: [], recipe: [] };
	
	let result: DeckValidationResult;
	// get card data from collection and input ids
	for (let cardId of args.deck.main) {
		//cardId = UUIDUtil.base64ToId(cardId);
		let card = collection.cards.find(c => c.id === cardId);
		if (!card) {
			result = { valid: false, reasons: [ "UNKNOWN_CARD" ] };
			return JSON.stringify(result);
		}
		deck.main.push(card);
	}

	for (let cardId of args.deck.recipe) {
		//cardId = UUIDUtil.base64ToId(cardId);
		let card = collection.cards.find(c => c.id === cardId);
		if (!card) {
			result = { valid: false, reasons: [ "UNKNOWN_CARD" ] };
			return JSON.stringify(result);
		}
		deck.recipe.push(card);
	}
	result = validateDeck(deck);
	return JSON.stringify(result);
	//storage.addPlayerDeck(ctx.userId);
}