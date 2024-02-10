import { ArrayUtil, Utility } from "../utility";
import { NakamaAdapter } from "../wrapper"

export const getPlayerDeckRpc: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let decks = storage.readPlayerDecks(ctx.userId);
	// automatically create new starter deck for player
	if (decks.length == 0) {
		let starterDecks = storage.readPlayerStarterDecks()
		let newDeck = ArrayUtil.pickRandom(starterDecks, 1)[0];
		storage.addPlayerDeck(ctx.userId, newDeck);
		decks.push(newDeck);
	}
	return JSON.stringify({ decks: decks })
}

export const updatePlayerDeckRpc: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	
}

export const deletePlayerDeckRpc: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	
}