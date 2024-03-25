import { Card } from "../model/cards";
import { DishSummonProcedure } from "../cards/cook_summon_procedure";
import { Recipe } from "../model/recipes";
import { createNakamaGameStorageAccess } from "../wrapper";
import { guardSystemOnly } from "../controllers/guard";

export const ingredientSetMaterialCheckRPC: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	guardSystemOnly(ctx, logger, nk, payload);
	
	// create API dependecy controllers
	let gameStorageAccess = createNakamaGameStorageAccess({ nk, logger });

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
export const recipeCheckRPC: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	guardSystemOnly(ctx, logger, nk, payload);

	// create API dependecy controllers
	let gameStorageAccess = createNakamaGameStorageAccess({ nk, logger });

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

export const dumpGameStateRPC: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	let data = JSON.parse(payload);
	let matchId = data.match;
	if (!matchId) {
		return JSON.stringify({ error: true, reason: "Missing match id parameter" })
	}
	let match = nk.matchGet(matchId);
	if (!match) {
		return JSON.stringify({ error: true, reason: "Match not found" })
	}
	return nk.matchSignal(match.matchId, "dump_state")

}