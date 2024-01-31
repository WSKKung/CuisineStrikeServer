import { CardEffectProvider } from "./src/effects/effect";
import { matchHandler, matchmakerMatched } from "./src/match_handler";
import { registerCardEffectScripts } from "./src/scripts";
import { dumpGameStateRPC, recipeCheckRPC } from "./src/test/test_rpcs";

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
	initializer.registerBeforeAuthenticateGoogle(beforeAuthenticateLogin);
	//registerTestRPCs(initializer);
	// Registers every testing RPC functions into the server
	initializer.registerRpc("recipe_check", recipeCheckRPC);
	initializer.registerRpc("dump_state", dumpGameStateRPC);
};

// Modify client matchmaking request
const beforeMacthmakerAdd: nkruntime.RtBeforeHookFunction<nkruntime.EnvelopeMatchmakerAdd> = function(ctx, logger, nk, envelope) {
	envelope.matchmakerAdd.minCount = 2;
	envelope.matchmakerAdd.maxCount = 2;
	return envelope;
};

const beforeAuthenticateLogin: nkruntime.BeforeHookFunction<nkruntime.AuthenticateGoogleRequest> = function(ctx, logger, nk, data) {
	return data;
}

// Reference InitModule to avoid it getting removed on build
!InitModule || InitModule.bind(null);