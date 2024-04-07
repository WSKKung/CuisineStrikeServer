import { ZodError, z } from "zod";
import { matchHandler, matchmakerMatched } from "./src/match_handler";
import { DeckSchemas, validateDeck } from "./src/model/decks";
import { CollectionSchemas } from "./src/model/player_collections";
import { dumpGameStateRPC, recipeCheckRPC } from "./src/controllers/test_rpcs";
import { IDGenerator, NakamaAdapter, createSequentialIDGenerator } from "./src/wrapper";
import { addCoinRPC, addToCollectionRPC, getCollectionRPC } from "./src/controllers/card_collection";
import { getDecklistRPC, updateDeckRPC, setActiveDeckRPC, validateDeckRPC, addDeckRPC, deleteDeckRPC, saveDeckRPC } from "./src/controllers/deck_building";
import { createPrivateRoomRpc, getPreviousOngoingMatchRpc } from "./src/controllers/matchmaking";
import { buyItemRpc, deleteShopSupplierRpc, getShopRpc, getShopSupplierRpc, updateShopSupplierRpc } from "./src/controllers/item_shop";
import { guardSystemOnly } from "./src/controllers/guard";
import { DEFAULT_LIFETIME_SHOP_SUPPLIER } from "./src/model/stores";

const InitModule: nkruntime.InitModule = function(ctx, logger, nk, initializer) {
	logger.info("Typescript Runtime initializing");
	initializer.registerRtBefore("MatchmakerAdd", beforeMacthmakerAdd);
	initializer.registerRtBefore("MatchJoin", beforeMatchJoin);
	logger.info("BeforeMatchmakerAdd hook registered");
	initializer.registerMatch("lobby", matchHandler);
	logger.info("MatchHandler registered");
	initializer.registerMatchmakerMatched(matchmakerMatched);
	logger.info("MatchmakerMatched hook registered");
	logger.info("Typescript Runtime ready, les go, woo!!!");
	initializer.registerStorageIndex("cards", "cards", undefined, ["name", "type", "description", "class", "grade", "power", "health"], 1000, false);

	initializer.registerAfterAuthenticateEmail(afterAuthenticateEmail);
	initializer.registerAfterAuthenticateDevice(afterAuthenticateDevice);
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
	initializer.registerRpc("AddCoin", addCoinRPC);
	
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
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let currentDeck = storage.readPlayerActiveDeck(ctx.userId);
	// disallow invalid deck
	let deckValidateResult = validateDeck(currentDeck);
	if (!deckValidateResult.valid) {
		return;
	}

	envelope.matchmakerAdd.minCount = 2;
	envelope.matchmakerAdd.maxCount = 2;
	return envelope;
};

const beforeMatchJoin: nkruntime.RtBeforeHookFunction<nkruntime.EnvelopeMatchJoin> = function(ctx, logger, nk, envelope) {
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let currentDeck = storage.readPlayerActiveDeck(ctx.userId);
	// disallow invalid deck
	let deckValidateResult = validateDeck(currentDeck);
	if (!deckValidateResult.valid) {
		return;
	}

	return envelope;
}

const afterAuthenticateEmail: nkruntime.AfterHookFunction<nkruntime.Session, nkruntime.AuthenticateEmailRequest> = function(ctx, logger, nk, data, request) {
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	// give coin to new user
	if (data.created) {
		const STARTING_COIN = 1000;
		storage.givePlayerCoin(ctx.userId, STARTING_COIN);
	}
}

const afterAuthenticateDevice: nkruntime.AfterHookFunction<nkruntime.Session, nkruntime.AuthenticateDeviceRequest> = function(ctx, logger, nk, data, request) {
	logger.debug("after auth device: data=%s request=%s", JSON.stringify(data), JSON.stringify(request));
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	// give coin to new user
	if (data.created) {
		const STARTING_COIN = 1000;
		storage.givePlayerCoin(ctx.userId, STARTING_COIN);
	}
}

// Reference InitModule to avoid it getting removed on build
!InitModule || InitModule.bind(null);