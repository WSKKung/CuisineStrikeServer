import { z } from "zod";
import { Deck } from "../model/decks";
import { NakamaAdapter } from "../wrapper";

const RPCSchemas = {
	addToCollection: z.object({
		playerId: z.string(),
		cards: z.array(z.number().int())
	})
}

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

export const getCollectionRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let collection = storage.readPlayerCardCollection(ctx.userId);
	return JSON.stringify(collection);
}

export const addToCollectionRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	if (!!ctx.userId && ctx.userId !== SYSTEM_USER_ID) {
		throw new Error("This RPC is for system only");
	}

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