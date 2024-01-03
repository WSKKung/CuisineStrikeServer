const InitModule: nkruntime.InitModule = function(ctx, logger, nk, initializer) {
	logger.info("Typescript Runtime initializing");
	initializer.registerRtBefore("MatchmakerAdd", beforeMacthmakerAdd);
	logger.info("BeforeMatchmakerAdd hook registered");
	initializer.registerMatch("lobby", matchHandler);
	logger.info("MatchHandler registered");
	initializer.registerMatchmakerMatched(matchmakerMatched)
	logger.info("MatchmakerMatched hook registered");
	logger.info("Typescript Runtime ready, les go, woo!!!");
	initializer.registerStorageIndex("cards", "cards", undefined, ["name", "type", "description", "class", "grade", "power", "health"], 1000, false);
	initializer.registerRpc("recipe_check", recipeCheckRPC);
};

// Modify client matchmaking request
const beforeMacthmakerAdd: nkruntime.RtBeforeHookFunction<nkruntime.EnvelopeMatchmakerAdd> = function(ctx, logger, nk, envelope) {
	envelope.matchmakerAdd.minCount = 2;
	envelope.matchmakerAdd.maxCount = 2;
	return envelope;
};

const recipeCheckRPC: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	let data = JSON.parse(payload);
	let cardCode: number = data.card;
	let materialsCode: Array<number> = data.materials;
	let recipe: Recipe = data.recipe;
	if (!recipe) {
		let loadedRecipe = DishSummonProcedure.loadRecipeFromCardCode(cardCode, nk);
		if (!loadedRecipe) {
			return JSON.stringify({ error: true, reason: "Given card has no recipe and no recipe override are provided."});
		}
		recipe = loadedRecipe;
	}

	// mock card and materials from given code
	// maybe need to support game state dependant properties override for complex recipe condition?
	let card: Card = Card.create(nk.uuidv4(), cardCode, "", Card.loadCardBaseProperties(cardCode, nk));
	let materials: Array<Card> = materialsCode.map(matCode => Card.create(nk.uuidv4(), matCode, "", Card.loadCardBaseProperties(matCode, nk)))

	let recipeCheckResult = DishSummonProcedure.checkIsRecipeComplete(recipe, card, materials);
	
	return JSON.stringify({ result: recipeCheckResult, card, materials });
}