import { z } from "zod";
import { Deck, DeckSchemas } from "../model/decks";
import { NakamaAdapter } from "../wrapper";

const RPCSchemas = {
	setActiveDeck: z.object({
		deckId: z.string()
	}),
	addDeck: z.object({
		deck: z.custom<Deck>()
	}),
	updateDeck: z.object({
		deck: z.custom<Deck>(),
		forced: z.boolean().optional()
	}),
	deleteDeck: z.object({
		deckId: z.string()
	}),
}

export const getDecklistRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {

	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let decklist = storage.readPlayerDecklist(ctx.userId);

	return JSON.stringify(decklist);
}

export const addDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let params = JSON.parse(payload);
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	//storage.addPlayerDeck(ctx.userId);
}

export const updateDeckRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let payloadParseResult = RPCSchemas.updateDeck.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	storage.updatePlayerDeck(ctx.userId, args.deck, !!args.forced);
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