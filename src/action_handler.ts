type ActionType = 
	"end_turn" |
	"set_ingredient" |
	"summon_dish" |
	"attack"

interface ActionResult {
	id: string,
	type: ActionType
	owner: string
	data?: any
}

interface ActionHandlerResult {
	success: boolean
	data?: any
}

interface ActionHandleContext {
	storageAccess: GameStorageAccess,
	gameState: GameState,
	senderId: string
}

type ActionHandler = (context: ActionHandleContext, params: any) => ActionHandlerResult

// middleware to validate turn player action
function validateTurnPlayer(next: ActionHandler): ActionHandler {
	return (context, params) => {
		if (!Match.isPlayerTurn(context.gameState, context.senderId)) {
			return { success: false, data: { reason: "NOT_TURN_PLAYER" } };
		}
		return next(context, params);
	}
}

// middleware to validate type of each properties in params object
function validateParams(expectedParams: { [name: string]: any }, next: ActionHandler): ActionHandler {
	return (context, params) => {
		for (let expectedKey in expectedParams) {
			let expectedType = expectedParams[expectedKey];
			let actualValue = params[expectedKey];
			let valid = true;
			if (typeof expectedType === "string") {
				if (typeof actualValue !== expectedType) {
					valid = false;
				}
			}
			else if (!(actualValue instanceof expectedType)) {
				valid = false;
			}
			if (!valid) {
				return { success: false, data: { reason: "INVALID_ARGUMENTS" } };
			}
		}
		return next(context, params);
	};
}

const endTurnActionHandler: ActionHandler = (context, params) => {
	
	Match.gotoNextTurn(context.gameState);

	return { success: true };
}

const setIngredientParamsSchema = {
	card: "string",
	column: "number",
	materials: Array<string>
};

const setIngredientHandler: ActionHandler = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;

	let cardIdToBeSet: string = params["card"];
	let columnToBeSet: number = params["column"];
	let materialsId: Array<string> = params["materials"];

	let cardToBeSet = Match.findCardByID(state, cardIdToBeSet);
	if (!cardIdToBeSet) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	// check card properties if can be set
	if (
		Card.getOwner(cardToBeSet!) !== playerId ||
		!Card.isAbleToSetAsIngredient(cardToBeSet!)
	) {
		return { success: false, data: { reason: "TARGET_CARD_CANNOT_BE_SET" } };
	}

	let requiredCost = Card.getIngredientMinimumMaterialCost(cardToBeSet!);
	let materials: Array<Card> = Match.findCardsById(state, materialsId);

	// check if player can actually use the given materials
	if (materials.some(card => {
		Card.getOwner(card) !== playerId ||
		!Card.hasLocation(card, CardLocation.STANDBY_ZONE)
	})) {
		return { success: false, data: { reason: "MATERIALS_INVALID" } };
	}

	// check material cost
	state.log!.debug("Player attempted to set %s with min cost %d", JSON.stringify(cardToBeSet!), requiredCost)
	let combinedCost: number = materials.length; //.map(card => Card.getGrade(card)).reduce((prev, cur) => prev + cur, 0);
	// TODO: allow exceeded cost, but disallow selecting more materials than minimum (e.g. player cannot select combination of grade 3 or higher if player `can` select combination of grade 2 for grade 3 ingredient)
	if (combinedCost !== requiredCost) {
		return { success: false, data: { reason: "MATERIALS_INVALID" } };
	}

	// check zone to set
	// allow setting in the same column as material since material will go to trash first, making the zone available
	if (!(Match.isZoneEmpty(state, CardLocation.STANDBY_ZONE, playerId, columnToBeSet) || materials.some(card => Card.getColumn(card) === columnToBeSet))) {
		return { success: false, data: { reason: "COLUMN_INVALID" } };
	}

	// send material to trash
	if (materials.length > 0) {
		Match.moveCard(state, materials, CardLocation.TRASH, playerId);
	}

	// place card onto the field
	Match.moveCard(state, [ cardToBeSet! ], CardLocation.STANDBY_ZONE, playerId, columnToBeSet);

	return { success: true , data: { card: cardIdToBeSet, column: columnToBeSet, materials: materialsId } };
}

const dishSummonParamsSchema = {
	card: "string",
	column: "number",
	materials: Array<string>
}

const dishSummonHandler: ActionHandler = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;

	let cardIdToSummon: string = params["card"];
	let columnToSummon: number = params["column"];
	let materialsId: Array<string> = params["materials"];

	let cardToSummon: Card | null = Match.findCardByID(state, cardIdToSummon);
	if (!cardToSummon) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	// check if player can actually summon the given cards
	if (
		Card.getOwner(cardToSummon) !== playerId ||
		!Card.hasLocation(cardToSummon, CardLocation.RECIPE_DECK)
	) {
		return { success: false, data: { reason: "TARGET_CARD_CANNOT_SUMMON" } };
	}

	let materials: Array<Card> = Match.findCardsById(state, materialsId);

	// check if player can actually use the given materials
	if (materials.some(card => {
		Card.getOwner(card) !== playerId ||
		!Card.hasLocation(card, CardLocation.STANDBY_ZONE)
	})) {
		return { success: false, data: { reason: "MATERIALS_INVALID" } };
	}

	// check zone to set
	if (!Match.isZoneEmpty(state, CardLocation.SERVE_ZONE, playerId, columnToSummon)) {
		return { success: false, data: { reason: "COLUMN_INVALID" } };
	}

	// load card recipe
	let recipe: Recipe | null = context.storageAccess.readDishCardRecipe(Card.getCode(cardToSummon));
	if (!recipe) {
		return { success: false, data: { reason: "TARGET_CARD_MISSING_RECIPE" } }
	}

	if (!DishSummonProcedure.checkIsRecipeComplete(recipe, cardToSummon, materials)) {
		return { success: false, data: { reason: "MATERIAL_INCORRECT" } };
	}

	// Send materials to trash
	Match.moveCard(state, materials, CardLocation.TRASH, playerId);

	// place card onto the field
	Match.moveCard(state, [ cardToSummon! ], CardLocation.SERVE_ZONE, playerId, columnToSummon);

	return { success: true, data: { card: cardIdToSummon, column: columnToSummon, materials: materialsId } };
}

const attackActionHandler: ActionHandler = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let opponent = Match.getOpponent(state, playerId);
	let opponentHP = Match.getHP(state, opponent);
	let damage = params["amount"] || 0;
	Match.setHP(state, opponent, opponentHP - damage);
	return { success: true, data: { } };
}

function getActionHandler(type: ActionType): ActionHandler | null {
	switch (type) {
		case "end_turn":
			return validateTurnPlayer(endTurnActionHandler);
		case "set_ingredient":
			return validateTurnPlayer(validateParams(setIngredientParamsSchema, setIngredientHandler));
		case "summon_dish":
			return validateTurnPlayer(validateParams(dishSummonParamsSchema, dishSummonHandler));
		case "attack":
			return validateTurnPlayer(attackActionHandler);
		default:
			return null
	}
}