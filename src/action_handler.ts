import { GameState, Match } from "./match";
import { Card } from "./card";
import { GameStorageAccess } from "./wrapper";
import { Recipe, DishSummonProcedure } from "./cards/cook_summon_procedure";
import { CardLocation } from "./card";
import zod from "zod";
import { GameConfiguration } from "./constants";

export type ActionType = 
	"end_turn" |
	"set_ingredient" |
	"summon_dish" |
	"attack"

export interface ActionResult {
	id: string,
	type: ActionType
	owner: string
	data?: any
}

export interface ActionHandlerResult {
	success: boolean
	data?: any
}

export interface ActionHandleContext {
	storageAccess: GameStorageAccess,
	gameState: GameState,
	senderId: string
}

export type ActionHandleFunction<ParamType = any> = (context: ActionHandleContext, params: ParamType) => ActionHandlerResult

type ActionParamSchema<ParamType extends zod.ZodRawShape> = zod.AnyZodObject

// middleware to validate turn player action
function validateTurnPlayer(next: ActionHandleFunction): ActionHandleFunction {
	return (context, params) => {
		if (!Match.isPlayerTurn(context.gameState, context.senderId)) {
			return { success: false, data: { reason: "NOT_TURN_PLAYER" } };
		}
		return next(context, params);
	}
}


// middleware to validate type of each properties in params object
function validateParams<ParamType>(schema: zod.ZodType<ParamType>, next: ActionHandleFunction<ParamType>): ActionHandleFunction<ParamType> {
	return (context, params) => {
		try {
			let result = schema.parse(params);
			return next(context, result);
		}
		catch (error) {
			return { success: false, data: { reason: "INVALID_ARGUMENT" } };
		}
	};
}

const x = zod.object({ a: zod.string() });
type XType = Zod.infer<typeof x>


const endTurnActionHandler: ActionHandleFunction = (context, params) => {
	
	Match.gotoNextTurn(context.gameState, context.senderId);

	return { success: true };
}

const setIngredientActionSchema = zod.object({
	card: zod.string(),
	column: zod.number().min(0).max(GameConfiguration.boardColumns - 1),
	materials: zod.array(zod.string())
})

type SetIngredientActionParams = zod.output<typeof setIngredientActionSchema>

const setIngredientHandler: ActionHandleFunction<SetIngredientActionParams> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;

	let cardIdToBeSet: string = params.card;
	let columnToBeSet: number = params.column;
	let materialsId: Array<string> = params.materials;

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
		Match.discard(state, materials, playerId);
	}

	// place card onto the field
	Match.setToStandby(state, cardToBeSet!, playerId, columnToBeSet);

	return { success: true , data: { card: cardIdToBeSet, column: columnToBeSet, materials: materialsId } };
}

const dishSummonActionSchema = zod.object({
	card: zod.string(),
	column: zod.number().min(0).max(GameConfiguration.boardColumns - 1),
	materials: zod.array(zod.string())
})
type DishSummonActionParams = zod.infer<typeof dishSummonActionSchema>

const dishSummonHandler: ActionHandleFunction<DishSummonActionParams> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;

	let cardIdToSummon: string = params.card;
	let columnToSummon: number = params.column;
	let materialsId: Array<string> = params.materials;

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
	Match.discard(state, materials, playerId);

	// place card onto the field
	Match.summon(state, cardToSummon!, playerId, columnToSummon);

	return { success: true, data: { card: cardIdToSummon, column: columnToSummon, materials: materialsId } };
}

const attackActionSchema = zod.union([
	zod.object({
		attacking_card: zod.string(),
		is_direct: zod.literal(true)
	}),
	zod.object({
		attacking_card: zod.string(),
		is_direct: zod.literal(false).optional(),
		target_card: zod.string()
	})
]);
type AttackActionParams = zod.infer<typeof attackActionSchema>

const attackActionHandler: ActionHandleFunction<AttackActionParams> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let opponent = Match.getOpponent(state, playerId);

	let attackingCardId: string = params.attacking_card;

	let attackingCard: Card | null = Match.findCardByID(state, attackingCardId);
	if (!attackingCard) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	// Direct Attack
	if (params.is_direct) {
		let opponentHP = Match.getHP(state, opponent);
		let damage = Card.getPower(attackingCard);
		opponentHP -= damage;
		Match.setHP(state, opponent, opponentHP);
	}
	// Battle with another card
	else {
		let targetCardId: string = params.target_card;
		let targetCard: Card | null = Match.findCardByID(state, targetCardId);
		if (!targetCard) {
			return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
		}

		let battlingCards = [ attackingCard, targetCard ];
		let destroyedCards: Card[] = []
		for (let i = 0; i < 2; i++) {
			let card = battlingCards[i];
			let opposingCard = battlingCards[2-i]
			let attackingPower = Card.getPower(card);
			let opposingHP = Card.getHealth(opposingCard);
			opposingHP -= attackingPower;
			Card.setHealth(opposingCard, opposingHP);
			Match.updateCard(state, opposingCard);
			if (opposingHP === 0) {
				destroyedCards.push(opposingCard);
			}
		}
	
		Match.discard(state, destroyedCards, playerId);
	}

	return { success: true, data: { } };
}

export function getActionHandler(type: ActionType): ActionHandleFunction | null {
	switch (type) {
		case "end_turn":
			return validateTurnPlayer(endTurnActionHandler);
		case "set_ingredient":
			return validateTurnPlayer(validateParams(setIngredientActionSchema, setIngredientHandler));
		case "summon_dish":
			return validateTurnPlayer(validateParams(dishSummonActionSchema, dishSummonHandler));
		case "attack":
			return validateTurnPlayer(validateParams(attackActionSchema, attackActionHandler));
		default:
			return null
	}
}