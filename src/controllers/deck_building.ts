import { z } from "zod";
import { Deck, DeckSchemas, validateDeck } from "../model/decks";
import { NakamaAdapter } from "../wrapper";

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
	deleteDeck: z.object({
		deckId: z.string()
	}),
	validateDeck: z.object({
		deck: z.custom<Deck>()
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

export const deleteDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let params = JSON.parse(payload);
	let storage = NakamaAdapter.storageAccess({ nk, logger });
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
	let result = validateDeck(args.deck);
	return JSON.stringify(result);
	//storage.addPlayerDeck(ctx.userId);
}