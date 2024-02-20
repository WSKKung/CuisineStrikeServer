import { GameState, Match, TurnPhase } from "./match";
import { GameStorageAccess } from "./wrapper";
import { DishSummonProcedure } from "./cards/cook_summon_procedure";
import { Recipe } from "./model/recipes";
import { CardLocation, Card, CardType } from "./model/cards";
import zod from "zod";
import { GameConfiguration } from "./constants";
import { SetIngredientActionParams, CookSummonActionParams, AttackActionParams, ActionType, actionSchemas, ActivateActionCardParams, ChooseCardsParams, getPlayerActionSchemaByType, PlayerActionParams, PlayerActionParamsActivate, PlayerActionParamsChooseCards, PlayerActionParamsAttack, PlayerActionParamsCookSummon, PlayerActionParamsSetIngredient, PlayerActionParamsToStrikePhase, PlayerActionParamsEndTurn, PlayerActionParamsChooseZones, PlayerActionParamsChooseYesNo, PlayerActionParamsChooseOption } from "./action_schema";
import { BUFF_ID_OVERGRADED, CardBuff, CardBuffResetCondition } from "./buff";
import { CardEffectProvider, CardEffectContext, CardActivateEffect } from "./effects/effect";
import { registerCardEffectScripts } from "./scripts";
import { EventReason } from "./events";

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

export type TypedActionHandleFunction<T extends ActionType> = ActionHandleFunction<PlayerActionParams & { type: T }>

export type ActionHandleFunction<ParamType = any> = {
	(context: ActionHandleContext, params: ParamType): ActionHandlerResult
}

// middleware to validate action available on open state
function validateOpenState(next: ActionHandleFunction): ActionHandleFunction {
	return (context, params) => {
		if (context.gameState.currentChoiceRequest != null) {
			return { success: false, data: { reason: "NOT_AVAILABLE" } };
		}
		return next(context, params);
	}
}

// middleware to validate turn player action
function validateTurnPlayer(next: ActionHandleFunction): ActionHandleFunction {
	return (context, params) => {
		if (!Match.isPlayerTurn(context.gameState, context.senderId)) {
			return { success: false, data: { reason: "NOT_TURN_PLAYER" } };
		}
		return next(context, params);
	}
}

// middleware to validate action on specific phase
function validatePhase(phase: TurnPhase, next: ActionHandleFunction): ActionHandleFunction {
	return (context, params) => {
		if (context.gameState.turnPhase !== phase) {
			return { success: false, data: { reason: "INCORRECT_PHASE" } };
		}
		return next(context, params);
	}
}

// middleware to validate type of each properties in params object
function validateParams<T extends ActionType>(type: T, next: TypedActionHandleFunction<T>): TypedActionHandleFunction<T> {
	return (context, params) => {
		try {
			let schema = getPlayerActionSchemaByType(type)
			let result = schema.parse(params);
			return next(context, result);
		}
		catch (error: any) {
			context.gameState.log?.debug(error.message)
			return { success: false, data: { reason: "INVALID_ARGUMENT" } };
		}
	};
}
const endTurnActionHandler: ActionHandleFunction<PlayerActionParamsEndTurn> = (context, params) => {
	Match.gotoNextTurn(context.gameState, context.senderId);
	return { success: true };
}

const goToStrikePhaseActionHandler: ActionHandleFunction<PlayerActionParamsToStrikePhase> = (context, params) => {
	if (!Match.isSetupPhase(context.gameState)) {
		return { success: false, data: { reason: "INVALID_PHASE" } };
	}
	Match.goToStrikePhase(context.gameState, context.senderId);
	return { success: true };
}

const setIngredientHandler: ActionHandleFunction<PlayerActionParamsSetIngredient> = (context, params) => {
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
		!Match.isCardCanSetAsIngredient(state, cardToBeSet!)
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
		Match.discard(state, materials, playerId, EventReason.SET | EventReason.COST);
	}

	// place card onto the field
	Match.setToStandby(state, cardToBeSet!, playerId, columnToBeSet);

	return { success: true , data: { card: cardIdToBeSet, column: columnToBeSet, materials: materialsId } };
}

const dishSummonHandler: ActionHandleFunction<PlayerActionParamsCookSummon> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;

	let cardIdToSummon: string = params.card;
	let columnToSummon: number = params.column;
	let materialsId: Array<string> = params.materials;

	if (!Match.isSetupPhase(state)) {
		return { success: false, data: { reason: "INVALID_PHASE" } };
	}

	let cardToSummon = Match.findCardByID(state, cardIdToSummon);
	if (!cardToSummon) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	// check if player can actually summon the given cards
	if (
		Card.getOwner(cardToSummon) !== playerId ||
		!Match.isCardCanCookSummon(state, cardToSummon)
	) {
		return { success: false, data: { reason: "TARGET_CARD_CANNOT_SUMMON" } };
	}

	// check quick-set card if it can be set
	if (params.quick_set && !Card.isAbleToSetAsIngredient(cardToSummon)) {
		return { success: false, data: { reason: "TARGET_CARD_CANNOT_SET" } };
	}

	let materials: Array<Card> = Match.findCardsById(state, materialsId);

	// check if player can actually use the given materials
	if (materials.some(card => {
		Card.getOwner(card) !== playerId ||
		!Card.hasLocation(card, CardLocation.STANDBY_ZONE)
	})) {
		return { success: false, data: { reason: "MATERIALS_INVALID" } };
	}

	let bonus_grade = materials.map(Card.getGrade).reduce((x, y) => x + y, -Card.getBaseGrade(cardToSummon));
	if (bonus_grade < 0) {
		return { success: false, data: { reason: "MATERIALS_UNDERGRADED" } };
	}

	// check zone to set
	// also allow quick-set into the same zone as one of the material used
	let targetZone = params.quick_set ? CardLocation.STANDBY_ZONE : CardLocation.SERVE_ZONE
	if (!Match.isZoneEmpty(state, targetZone, playerId, columnToSummon) && !(params.quick_set && materials.some(mat => mat.column === columnToSummon))) {
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
	Match.discard(state, materials, playerId, EventReason.SUMMON | EventReason.COST);
	
	// place card onto the field
	Match.summon(state, cardToSummon!, playerId, columnToSummon, EventReason.SUMMON, params.quick_set);

	if (bonus_grade > 0) {
		let overgradedBuff: CardBuff = {
			id: BUFF_ID_OVERGRADED,
			sourceCard: cardToSummon!,
			type: "grade",
			operation: "add",
			amount: bonus_grade,
			resets: CardBuffResetCondition.SOURCE_REMOVED | CardBuffResetCondition.TARGET_REMOVED
		}
		Match.addBuff(state, [cardToSummon!], overgradedBuff);		
	}

	return { success: true, data: { card: cardIdToSummon, column: columnToSummon, materials: materialsId } };
}


const attackActionHandler: ActionHandleFunction<PlayerActionParamsAttack> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let opponent = Match.getOpponent(state, playerId);

	if (!Match.isStrikePhase(state)) {
		return { success: false, data: { reason: "INVALID_PHASE" } };
	}

	let attackingCardId: string = params.attacking_card;

	let attackingCard: Card | null = Match.findCardByID(state, attackingCardId);
	if (!attackingCard) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	if (
		Card.getOwner(attackingCard) !== playerId
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

const activateActionCardHandler: ActionHandleFunction<PlayerActionParamsActivate> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let activatedCardId: string = params.card;
	let activatedCard: Card | null = Match.findCardByID(state, activatedCardId);
	if (!activatedCard) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	if (
		Card.getOwner(activatedCard) != playerId ||
		!Card.canPosibblyActivateEffect(activatedCard)
	) {
		return { success: false, data: { reason: "TARGET_CARD_INVALID" } };
	}
	
	state.log?.debug("Player attempted to activate cards with code: %d", Card.getCode(activatedCard))

	// check activation condition
	if (!Match.isCardCanActivateAbility(state, activatedCard)) {
		return { success: false, data: { reason: "TARGET_CARD_CANNOT_USE_ABILITY" } };
	}

	Match.activateAbility(state, playerId, activatedCard);

	return { success: true, data: {} };
}

const chooseCardsHandler: ActionHandleFunction<PlayerActionParamsChooseCards> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let cardRequest = state.currentChoiceRequest;
	if (!cardRequest || cardRequest.type !== "choose_cards" || cardRequest.playerId !== playerId) {
		return { success: false, data: { reason: "CHOICE_NOT_REQUESTED" }};
	}
	
	let chosenCardIds: string[] = params.cards as string[]
	if (chosenCardIds.length < cardRequest.min || chosenCardIds.length > cardRequest.max) {
		return { success: false, data: { reason: "INVALID_CARD_CHOICE" }};
	}

	for (let selectedCardId of chosenCardIds) {
		if (cardRequest.cards.every(card => card.id !== selectedCardId)) {
			return { success: false, data: { reason: "INVALID_CARD_CHOICE" }};
		}
	}

	cardRequest.callback(Match.findCardsById(state, chosenCardIds))

	return { success: true, data: {} };
}

const chooseZonesHandler: ActionHandleFunction<PlayerActionParamsChooseZones> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let cardRequest = state.currentChoiceRequest;
	if (!cardRequest || cardRequest.type !== "choose_zones" || cardRequest.playerId !== playerId) {
		return { success: false, data: { reason: "CHOICE_NOT_REQUESTED" }};
	}
	
	let chosenZones = params.zones
	if (chosenZones.length < cardRequest.min || chosenZones.length > cardRequest.max) {
		return { success: false, data: { reason: "INVALID_ZONE_CHOICE" }};
	}

	for (let zone of chosenZones) {
		if (cardRequest.zones.every(optionZone => optionZone.location !== zone.location || optionZone.column !== zone.column )) {
			return { success: false, data: { reason: "INVALID_ZONE_CHOICE" }};
		}
	}

	cardRequest.callback(chosenZones.map(z => Match.findZones(context.gameState, z.location, z.owner, z.column)[0]))

	return { success: true, data: {} };
}


const chooseYesNoHandler: ActionHandleFunction<PlayerActionParamsChooseYesNo> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let cardRequest = state.currentChoiceRequest;
	if (!cardRequest || cardRequest.type !== "choose_yes_no" || cardRequest.playerId !== playerId) {
		return { success: false, data: { reason: "CHOICE_NOT_REQUESTED" }};
	}
	
	cardRequest.callback(params.choice)

	return { success: true, data: {} };
}

const chooseOptionHandler: ActionHandleFunction<PlayerActionParamsChooseOption> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let cardRequest = state.currentChoiceRequest;
	if (!cardRequest || cardRequest.type !== "choose_option" || cardRequest.playerId !== playerId) {
		return { success: false, data: { reason: "CHOICE_NOT_REQUESTED" }};
	}
	
	cardRequest.callback(params.choice)

	return { success: true, data: {} };
}

export function getActionHandler(type: ActionType): ActionHandleFunction | null {
	//let paramSchema = getPlayerActionSchemaByType(type);
	//let handler: ActionHandleFunction | null = null;
	switch (type) {
		case "end_turn":
			return validateOpenState(validateTurnPlayer(validateParams(type, endTurnActionHandler)));
		case "go_to_strike_phase":
			return validateOpenState(validatePhase("setup", validateTurnPlayer(validateParams(type, goToStrikePhaseActionHandler))));
		case "set_ingredient":
			return validateOpenState(validatePhase("setup", validateTurnPlayer(validateParams(type, setIngredientHandler))));
		case "cook_summon":
			return validateOpenState(validatePhase("setup", validateTurnPlayer(validateParams(type, dishSummonHandler))));
		case "attack":
			return validateOpenState(validatePhase("strike", validateTurnPlayer(validateParams(type, attackActionHandler))));
		case "activate":
			return validateOpenState(validateTurnPlayer(validateParams(type, activateActionCardHandler)));
		case "choose_cards":
			return validateParams(type, chooseCardsHandler);
		case "choose_zones":
			return validateParams(type, chooseZonesHandler);
		case "choose_yes_no":
			return validateParams(type, chooseYesNoHandler);
		case "choose_option":
			return validateParams(type, chooseOptionHandler);
		default:
			return null
	}
}