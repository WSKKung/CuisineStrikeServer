const ingredientSetMaterialCheckRPC: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	// create API dependecy controllers
	let gameStorageAccess = createNakamaGameStorageAccess(nk);

	let data = JSON.parse(payload);
	let cardCode: number = data.card;
	let materialsCode: Array<number> = data.materials;
	
	// mock card and materials from given code
	let card: Card;
	try {
		card = Card.create(nk.uuidv4(), cardCode, "", gameStorageAccess.readCardProperty(cardCode));
	} catch (err: unknown) {
		return JSON.stringify({ error: true, reason: "Given card with the specified code is not properly registered into cards database yet."});
	}

	let materials: Array<Card>;
	try {
		materials = materialsCode.map(matCode => Card.create(nk.uuidv4(), matCode, "", gameStorageAccess.readCardProperty(matCode)))
	} catch (err: unknown) {
		return JSON.stringify({ error: true, reason: "Given materials have a card code that is not properly registered into cards database yet."});
	}

	let ingredientMaterialCheckResult = false;
	return JSON.stringify({ result: ingredientMaterialCheckResult, card, materials });

}

/** Check materials validity against card's recipe.
 * @param ctx
 * @param logger
 * @param nk
 * @param payload
 * @returns
*/
const recipeCheckRPC: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	// create API dependecy controllers
	let gameStorageAccess = createNakamaGameStorageAccess(nk);

	let data = JSON.parse(payload);
	let cardCode: number = data.card;
	let materialsCode: Array<number> = data.materials;

	// mock card and materials from given code
	// maybe need to support game state dependant properties override for complex recipe condition?
	let card: Card;
	try {
		card = Card.create(nk.uuidv4(), cardCode, "", gameStorageAccess.readCardProperty(cardCode));
	} catch (err: unknown) {
		return JSON.stringify({ error: true, reason: "Given card with the specified code is not properly registered into cards database yet."});
	}

	let materials: Array<Card>;
	try {
		materials = materialsCode.map(matCode => Card.create(nk.uuidv4(), matCode, "", gameStorageAccess.readCardProperty(matCode)))
	} catch (err: unknown) {
		return JSON.stringify({ error: true, reason: "Given materials have a card code that is not properly registered into cards database yet."});
	}

	// use overrided recipe or load recipe from given card code
	let recipe: Recipe = data.recipe;
	if (!recipe) {
		let loadedRecipe = gameStorageAccess.readDishCardRecipe(cardCode);
		if (!loadedRecipe) {
			return JSON.stringify({ error: true, reason: "Given card has no recipe and no recipe override are provided."});
		}
		recipe = loadedRecipe;
	}

	let recipeCheckResult = DishSummonProcedure.checkIsRecipeComplete(recipe, card, materials);
	
	return JSON.stringify({ result: recipeCheckResult, card, materials });
}

/**
 * Registers every testing RPC functions into the server
 * @param initializer 
 */
function registerTestRPCs(initializer: nkruntime.Initializer) {
	initializer.registerRpc("recipe_check", recipeCheckRPC);
}