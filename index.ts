import { z } from "zod";
import { matchHandler, matchmakerMatched } from "./src/match_handler";
import { DeckSchemas } from "./src/model/decks";
import { CollectionSchemas } from "./src/model/player_collections";
import { dumpGameStateRPC, recipeCheckRPC } from "./src/controllers/test_rpcs";
import { IDGenerator, NakamaAdapter, createSequentialIDGenerator } from "./src/wrapper";
import { addToCollectionRPC, getCollectionRPC } from "./src/controllers/card_collection";
import { getDecklistRPC, updateDeckRPC, setActiveDeckRPC, validateDeckRPC, addDeckRPC, deleteDeckRPC, saveDeckRPC } from "./src/controllers/deck_building";
import { createPrivateRoomRpc, getPreviousOngoingMatchRpc } from "./src/controllers/matchmaking";
import { buyItemRpc, deleteShopSupplierRpc, getShopRpc, getShopSupplierRpc, updateShopSupplierRpc } from "./src/controllers/item_shop";
import { guardSystemOnly } from "./src/controllers/guard";
import { DEFAULT_LIFETIME_SHOP_SUPPLIER } from "./src/model/stores";

const InitModule: nkruntime.InitModule = function(ctx, logger, nk, initializer) {
	logger.info("Typescript Runtime initializing");
	initializer.registerRtBefore("MatchmakerAdd", beforeMacthmakerAdd);
	logger.info("BeforeMatchmakerAdd hook registered");
	initializer.registerMatch("lobby", matchHandler);
	logger.info("MatchHandler registered");
	initializer.registerMatchmakerMatched(matchmakerMatched);
	logger.info("MatchmakerMatched hook registered");
	logger.info("Typescript Runtime ready, les go, woo!!!");
	initializer.registerStorageIndex("cards", "cards", undefined, ["name", "type", "description", "class", "grade", "power", "health"], 1000, false);
	initializer.registerBeforeAuthenticateEmail(beforeAuthenticateLogin);
	initializer.registerAfterAuthenticateEmail(afterAuthenticateEmail)
	//registerTestRPCs(initializer);
	// Registers every testing RPC functions into the server
	initializer.registerRpc("DebugRecipeCheck",recipeCheckRPC);
	initializer.registerRpc("DebugDumpState", dumpGameStateRPC);
	initializer.registerRpc("GetCardProperties", getCardPropertiesRPC);
	initializer.registerRpc("GetDecklist", getDecklistRPC);
	//initializer.registerRpc("AddDeck", addDeckRPC);
	//initializer.registerRpc("UpdateDeck", updateDeckRPC);
	initializer.registerRpc("SaveDeck", saveDeckRPC);
	initializer.registerRpc("DeleteDeck", deleteDeckRPC);
	initializer.registerRpc("ValidateDeck", validateDeckRPC);
	initializer.registerRpc("SetActiveDeck", setActiveDeckRPC);
	
	initializer.registerRpc("GetCollection", getCollectionRPC);
	initializer.registerRpc("AddToCollection", addToCollectionRPC);
	
	initializer.registerRpc("CreatePrivateRoom", createPrivateRoomRpc);
	initializer.registerRpc("FindPreviousOngoingMatch", getPreviousOngoingMatchRpc);

	initializer.registerRpc("GetShopSupplier", getShopSupplierRpc);
	initializer.registerRpc("UpdateShopSupplier", updateShopSupplierRpc);
	initializer.registerRpc("DeleteShopSupplierStock", deleteShopSupplierRpc);
	initializer.registerRpc("GetShop", getShopRpc);
	initializer.registerRpc("BuyShopItem", buyItemRpc);

	try {
		updateShopSupplierRpc(ctx, logger, nk, JSON.stringify({
			shop: DEFAULT_LIFETIME_SHOP_SUPPLIER,
			update_mode: "add",
			duplicate_mode: "replace"
		}));
	} catch (err) {
		logger.error("Error updating default shop supplier! %s", err)
	}
	
};

const getCardPropertiesRPC: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let params = JSON.parse(payload);
	let cardCode: number = params.code;

	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let cardProperties = storage.readCardProperty(cardCode)

	return JSON.stringify(cardProperties);
}
// Modify client matchmaking request
const beforeMacthmakerAdd: nkruntime.RtBeforeHookFunction<nkruntime.EnvelopeMatchmakerAdd> = function(ctx, logger, nk, envelope) {
	envelope.matchmakerAdd.minCount = 2;
	envelope.matchmakerAdd.maxCount = 2;
	return envelope;
};

const beforeAuthenticateLogin: nkruntime.BeforeHookFunction<nkruntime.AuthenticateEmailRequest> = function(ctx, logger, nk, data) {
	// disconnect other session first
	//logger.debug("debug before auth: data=%s, ctx=%s", JSON.stringify(data), JSON.stringify(ctx));
	//let currentUsers = nk.usersGetUsername([ data.username ]);
	//if (currentUsers.length > 0 && currentUsers[0].online) {
	//	nk.sessionLogout(currentUsers[0].userId);
	//}//
	return data;
}

const afterAuthenticateEmail: nkruntime.AfterHookFunction<nkruntime.Session, nkruntime.AuthenticateEmailRequest> = function(ctx, logger, nk, data, request) {
	
	//logger.debug("debug after auth: data=%s, req=%s, ctx=%s", JSON.stringify(data), JSON.stringify(request), JSON.stringify(ctx));
	let currentUsers = nk.usersGetId([ ctx.userId ]);
	//let account = nk.accountGetId(ctx.userId);
	//let userMetadata = account.user.metadata;
	if (currentUsers.length > 0) {
		logger.debug("users exists: %s", JSON.stringify(currentUsers))
		//nk.sessionLogout(currentUsers[0].userId);
	}//
}

// Reference InitModule to avoid it getting removed on build
!InitModule || InitModule.bind(null);