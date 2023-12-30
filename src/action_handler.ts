type ActionType = 
	"end_turn" |
	"set_ingredient" |
	"summon_dish" |
	"attack"

interface ActionResult {
	type: ActionType
	owner: string
	success: boolean
	data?: any
}

type ActionHandler = (state: GameState, playerId: string, params: any) => ActionResult


// middleware to validate type of each properties in params object
function validateParams(type: ActionType, expectedParams: { [name: string]: any }, next: ActionHandler): ActionHandler {
	return (state, playerId, params) => {
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
				return { type: type, owner: playerId, success: false, data: { reason: "INVALID_ARGUMENTS" } };
			}
		}
		return next(state, playerId, params);
	};
}

const endTurnActionHandler: ActionHandler = (state, playerId, params) => {
	if (!Match.isPlayerTurn(state, playerId)) {
		return { type: "end_turn", owner: playerId, success: false, data: { reason: "NOT_TURN_PLAYER" } };
	}
	
	Match.gotoNextTurn(state);

	return { type: "end_turn", owner: playerId, success: true };
}

const setIngredientParamsSchema = {
	card: "string",
	column: "number",
	materials: Array<string>
};

const setIngredientHandler: ActionHandler = (state, playerId, params) => {
	if (!Match.isPlayerTurn(state, playerId)) {
		return { type: "set_ingredient", owner: playerId, success: false, data: { reason: "NOT_TURN_PLAYER" } };
	}

	let cardIdToBeSet: string = params["card"];
	let columnToBeSet: number = params["column"];
	let materialsId: Array<string> = params["materials"];

	let cardToBeSet = Match.findCardByID(state, cardIdToBeSet, CardLocation.ANYWHERE, playerId);
	if (!cardIdToBeSet) {
		return { type: "set_ingredient", owner: playerId, success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	// check card properties if can be set
	if (!Card.isAbleToSetAsIngredient(cardToBeSet!)) {
		return { type: "set_ingredient", owner: playerId, success: false, data: { reason: "TARGET_CARD_CANNOT_BE_SET" } };
	}

	// check material cost
	let requiredCost = Card.getIngredientMaterialCost(cardToBeSet!);
	let materials: Array<Card> = materialsId.map(id => Match.findCardByID(state, id, CardLocation.STANDBY_ZONE, playerId)).filter(card => card !== null).map(card => card!);
	if (requiredCost > 0) {
		let combinedCost: number = materials.map(card => Card.getGrade(card)).reduce((prev, cur) => prev + cur, 0);
		// TODO: allow exceeded cost, but disallow selecting more materials than minimum (e.g. player cannot select combination of grade 3 or higher if player `can` select combination of grade 2 for grade 3 ingredient)
		if (combinedCost === requiredCost) {
			return { type: "set_ingredient", owner: playerId, success: false, data: { reason: "MATERIALS_INVALID" } };
		}
	}

	// check zone to set
	// allow setting in the same column as material since material will go to trash first, making the zone available
	if (!Match.isZoneEmpty(state, CardLocation.STANDBY_ZONE, playerId, columnToBeSet) && !materials.some(card => Card.getColumn(card) === columnToBeSet)) {
		return { type: "set_ingredient", owner: playerId, success: false, data: { reason: "COLUMN_INVALID" } };
	}

	// send material to trash
	Match.moveCard(state, materials, CardLocation.TRASH, playerId);

	// place card onto the field
	Match.moveCard(state, [ cardToBeSet! ], CardLocation.STANDBY_ZONE, playerId, columnToBeSet);

	return { type: "set_ingredient", owner: playerId, success: true , data: { card: cardIdToBeSet, column: columnToBeSet, materials: materialsId } };
}

const attackActionHandler: ActionHandler = (state, playerId, params) => {
	if (!Match.isPlayerTurn(state, playerId)) {
		return { type: "attack", owner: playerId, success: false, data: { reason: "NOT_TURN_PLAYER" } };
	}
	let opponent = Match.getOpponent(state, playerId);
	let opponentHP = Match.getHP(state, opponent);
	let damage = params["amount"] || 0;
	Match.setHP(state, opponent, opponentHP - damage);
	return { type: "attack", owner: playerId, success: true, data: { } };
}

function getActionHandler(type: ActionType): ActionHandler | null {
	switch (type) {
		case "end_turn":
			return endTurnActionHandler;
		case "set_ingredient":
			return validateParams("set_ingredient", setIngredientParamsSchema, setIngredientHandler);
		case "attack":
			return attackActionHandler;
		default:
			return null
	}
}