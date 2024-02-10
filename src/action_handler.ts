import { GameState, Match, TurnPhase } from "./match";
import { GameStorageAccess } from "./wrapper";
import { DishSummonProcedure } from "./cards/cook_summon_procedure";
import { Recipe } from "./model/recipes";
import { CardLocation, Card } from "./model/cards";
import zod from "zod";
import { GameConfiguration } from "./constants";
import { SetIngredientActionParams, CookSummonActionParams, AttackActionParams, ActionType, actionSchemas, ActivateActionCardParams, ChooseCardsParams } from "./action_schema";
import { BUFF_ID_OVERGRADED, CardBuff, CardBuffResetCondition } from "./buff";
import { CardEffectProvider, CardEffectContext } from "./effects/effect";
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
function validateParams<ParamType>(schema: zod.ZodType<ParamType>, next: ActionHandleFunction<ParamType>): ActionHandleFunction<ParamType> {
	return (context, params) => {
		try {
			let result = schema.parse(params);
			return next(context, result);
		}
		catch (error: any) {
			context.gameState.log?.debug(error.message)
			return { success: false, data: { reason: "INVALID_ARGUMENT" } };
		}
	};
}
const endTurnActionHandler: ActionHandleFunction = (context, params) => {
	Match.gotoNextTurn(context.gameState, context.senderId);
	return { success: true };
}

const goToStrikePhaseActionHandler: ActionHandleFunction = (context, params) => {
	if (!Match.isSetupPhase(context.gameState)) {
		return { success: false, data: { reason: "INVALID_PHASE" } };
	}
	Match.goToStrikePhase(context.gameState, context.senderId);
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
		Match.discard(state, materials, playerId, EventReason.SET | EventReason.COST);
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
		!Card.hasLocation(cardToSummon, CardLocation.RECIPE_DECK)
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
			resets: CardBuffResetCondition.SOURCE_REMOVED
		}
		Match.addBuff(state, [cardToSummon!], overgradedBuff);		
	}

	return { success: true, data: { card: cardIdToSummon, column: columnToSummon, materials: materialsId } };
}


const attackActionHandler: ActionHandleFunction<AttackActionParams> = (context, params) => {
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

const activateActionCardHandler: ActionHandleFunction<ActivateActionCardParams> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let activatedCardId: string = params.card;
	let activatedCard: Card | null = Match.findCardByID(state, activatedCardId);
	if (!activatedCard) {
		return { success: false, data: { reason: "TARGET_CARD_NOT_EXISTS" } };
	}

	if (
		Card.getOwner(activatedCard) != playerId ||
		Card.getLocation(activatedCard) != CardLocation.HAND
	) {
		return { success: false, data: { reason: "TARGET_CARD_INVALID" } };
	}
	
	state.log?.debug("Player attempted to activate cards with code: %d", Card.getCode(activatedCard))
	//state.log?.debug("Before register: %s", JSON.stringify(CardEffectProvider.effects))
	//registerCardEffectScripts()
	//state.log?.debug("Current register: %s", JSON.stringify(CardEffectProvider.effects))


	let activatedEffect = CardEffectProvider.getEffect(Card.getCode(activatedCard));
	if (!activatedEffect) {
		return { success: false, data: { reason: "TARGET_CARD_HAS_NO_EFFECT" } };
	}

	let activationContext: CardEffectContext = { state: context.gameState, player: context.senderId, card: activatedCard }

	// check activation condition
	if (!activatedEffect.condition(activationContext)) {
		return { success: false, data: { reason: "CONDITION_NOT_MET" } };
	}

	state.eventQueue.push({ id: Match.newUUID(state), player: playerId, type: "activate", card: activatedCard, reason: EventReason.ACTIVATE, sourcePlayer: playerId })

	// run card activate script
	activatedEffect.activate(activationContext).then((_) => {
		Match.discard(state, [activatedCard!], playerId, EventReason.GAMERULE);
	});

	return { success: true, data: { } };
}

const chooseCardsHandler: ActionHandleFunction<ChooseCardsParams> = (context, params) => {
	let state = context.gameState;
	let playerId = context.senderId;
	let cardRequest = Match.getPlayer(state, playerId).cardRequest;
	if (!cardRequest) {
		return { success: false, data: { reason: "CARD_CHOICES_NOT_REQUESTED" }}
	}
	
	let chosenCardIds: string[] = params.cards as string[]
	if (chosenCardIds.length < cardRequest.min || chosenCardIds.length > cardRequest.max) {
		return { success: false, data: { reason: "INVALID_CARD_CHOICES" }}
	}

	for (let selectedCardId of chosenCardIds) {
		if (cardRequest.cards.every(card => card.id !== selectedCardId)) {
			return { success: false, data: { reason: "INVALID_CARD_CHOICES" }}
		}
	}

	cardRequest.callback(Match.findCardsById(state, chosenCardIds))

	return { success: true, data: {} };
}

export function getActionHandler(type: ActionType): ActionHandleFunction | null {
	switch (type) {
		case "end_turn":
			return validateTurnPlayer(endTurnActionHandler);
		case "go_to_strike_phase":
			return validatePhase("setup", validateTurnPlayer(goToStrikePhaseActionHandler));
		case "set_ingredient":
			return validatePhase("setup", validateTurnPlayer(validateParams(actionSchemas.setIngredient, setIngredientHandler)));
		case "cook_summon":
			return validatePhase("setup", validateTurnPlayer(validateParams(actionSchemas.cookSummon, dishSummonHandler)));
		case "attack":
			return validatePhase("strike", validateTurnPlayer(validateParams(actionSchemas.attack, attackActionHandler)));
		case "activate_action":
			return validateTurnPlayer(validateParams(actionSchemas.activateAction, activateActionCardHandler))
		case "choose_cards":
			return validateParams(actionSchemas.chooseCards, chooseCardsHandler)
		default:
			return null
	}
}