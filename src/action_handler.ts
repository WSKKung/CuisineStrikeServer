import { GameState, Match } from "./match";
import { Card } from "./card";
import { GameStorageAccess } from "./wrapper";
import { Recipe, DishSummonProcedure } from "./cards/cook_summon_procedure";
import { CardLocation } from "./card";
import zod from "zod";
import { GameConfiguration } from "./constants";
import { SetIngredientActionParams, CookSummonActionParams, AttackActionParams, ActionType, actionSchemas } from "./action_schema";

export type ActionHandlerResult = {
	success: true
	data?: any
} | {
	success: false,
	data: {
		reason: string,
		error?: any
	}
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
		catch (error: any) {
			return { success: false, data: { reason: "INVALID_ARGUMENT" } };
		}
	};
}

const endTurnActionHandler: ActionHandleFunction = (context, params) => {
	
	Match.gotoNextTurn(context.gameState, context.senderId);

	return { success: true };
}

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
		Match.discard(state, materials, playerId, "set_ingredient_cost");
	}

	// place card onto the field
	Match.setToStandby(state, cardToBeSet!, playerId, columnToBeSet);

	return { success: true , data: { card: cardIdToBeSet, column: columnToBeSet, materials: materialsId } };
}

const dishSummonHandler: ActionHandleFunction<CookSummonActionParams> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;

	let cardIdToSummon: string = params.card;
	let columnToSummon: number = params.column;
	let materialsId: Array<string> = params.materials;

	let cardToSummon = Match.findCardByID(state, cardIdToSummon);
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
	Match.discard(state, materials, playerId, "cook_summon_cost");

	// calculate extra stats
	let grade = materials.map(Card.getGrade).reduce((x, y) => x + y, 0);

	Card.setGrade(cardToSummon, grade);

	let bonusGrade = Card.getBonusGrade(cardToSummon);
	
	Card.setPower(cardToSummon, Card.getBasePower(cardToSummon) + bonusGrade * Card.getBonusPower(cardToSummon));
	Card.setHealth(cardToSummon, Card.getBaseHealth(cardToSummon) + bonusGrade * Card.getBonusHealth(cardToSummon));
	
	// place card onto the field
	Match.summon(state, cardToSummon!, playerId, columnToSummon, "cook_summon");

	return { success: true, data: { card: cardIdToSummon, column: columnToSummon, materials: materialsId } };
}


const attackActionHandler: ActionHandleFunction<AttackActionParams> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let opponent = Match.getOpponent(state, playerId);

	let attackingCardId: string = params.attacking_card;

	let attackingCard: Card | null = Match.findCardByID(state, attackingCardId);
	if (!attackingCard) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	if (
		Card.getOwner(attackingCard) !== playerId ||
		!Card.hasLocation(attackingCard, CardLocation.SERVE_ZONE)
	) {
		return { success: false, data: { reason: "TARGET_CARD_INVALID" } };
	}

	// check if card can attack
	if (!Match.isCardCanAttack(state, attackingCard)) {
		return { success: false, data: { reason: "TARGET_CARD_CANNOT_ATTACK" } };
	}

	// Direct Attack
	if (params.is_direct) {

		// check if player can attack directly
		if (!Match.isZoneEmpty(state, CardLocation.SERVE_ZONE, opponent, null) || state.turnCount <= 1) {
			return { success: false, data: { reason: "CANNOT_ATTACK_DIRECTLY" } };
		}

		Match.attackPlayer(state, playerId, attackingCard, opponent);
	}
	// Battle with another card
	else {
		let targetCardId: string = params.target_card || "";
		let targetCard: Card | null = Match.findCardByID(state, targetCardId);
		if (!targetCard) {
			return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
		}

		if (
			Card.getOwner(targetCard) === playerId ||
			!Card.hasLocation(targetCard, CardLocation.SERVE_ZONE)
		) {
			return { success: false, data: { reason: "ATTACK_TARGET_CARD_INVALID" } };
		}

		Match.battle(state, playerId, attackingCard, targetCard);
	}

	return { success: true, data: { } };
}

export function getActionHandler(type: ActionType): ActionHandleFunction | null {
	switch (type) {
		case "end_turn":
			return validateTurnPlayer(endTurnActionHandler);
		case "set_ingredient":
			return validateTurnPlayer(validateParams(actionSchemas.setIngredient, setIngredientHandler));
		case "summon_dish":
			return validateTurnPlayer(validateParams(actionSchemas.cookSummon, dishSummonHandler));
		case "attack":
			return validateTurnPlayer(validateParams(actionSchemas.attack, attackActionHandler));
		default:
			return null
	}
}