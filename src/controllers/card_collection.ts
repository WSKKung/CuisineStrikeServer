import { z } from "zod";
import { Deck } from "../model/decks";
import { NakamaAdapter } from "../wrapper";
import { guardSystemOnly } from "./guard";

const RPCSchemas = {
	addToCollection: z.object({
		playerId: z.string(),
		cards: z.array(z.number().int())
	}),
	addCoin: z.object({
		playerId: z.string(),
		coin: z.number().int()
	})
}

export const getCollectionRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let collection = storage.readPlayerCardCollection(ctx.userId);
	return JSON.stringify(collection);
}

export const addToCollectionRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	guardSystemOnly(ctx, logger, nk, payload);
	let payloadParseResult = RPCSchemas.addToCollection.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;

	if (nk.usersGetId([args.playerId]).length === 0) {
		throw new Error("Target player does not exist")
	}

	let storage = NakamaAdapter.storageAccess({ nk, logger });
	storage.addCardToPlayerCollection(args.playerId, args.cards.map(code => ({ id: nk.uuidv4(), code: code })));

	return JSON.stringify({ success: true });
}

export const addCoinRPC: nkruntime.RpcFunction  = function(ctx, logger, nk, payload) {
	guardSystemOnly(ctx, logger, nk, payload);
	let payloadParseResult = RPCSchemas.addCoin.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;

	if (nk.usersGetId([args.playerId]).length === 0) {
		throw new Error("Target player does not exist")
	}

	let storage = NakamaAdapter.storageAccess({ nk, logger });
	storage.givePlayerCoin(args.playerId, args.coin);

	return JSON.stringify({ success: true });
}