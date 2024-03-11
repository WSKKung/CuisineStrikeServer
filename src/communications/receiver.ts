import { error } from "console";
import { getActionHandler, ActionHandlerResult, ActionHandleContext, ActionHandleFunction } from "../action_handler";
import { ActionType, getPlayerActionSchemaByType } from "../action_schema";
import { GameState, Match } from "../match";
import { MatchMessageDispatcher, GameStorageAccess } from "../wrapper";
import { MatchEventCode, PlayerActionCode } from "./event_codes";
import { sendToPlayer } from "./sender";

export function receivePlayerMessage(state: GameState, senderId: string, opCode: number, msg: string, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, storageAccess: GameStorageAccess) {
	// parse message payload
	let params: any
	try {
		params = JSON.parse(msg);
	}
	catch (err) {
		logger.info(`Error parsing data string from message: ${msg}`);
		sendErrorToPlayer(dispatcher, senderId, { reason: "INVALID_JSON_MESSAGE" });
		return;
	}

	let context: ActionHandleContext = {
		logger: logger,
		storageAccess: storageAccess,
		gameState: state,
		senderId: senderId
	}

	switch (opCode) {
		case PlayerActionCode.MESSAGE:
			genericMessageHandler(senderId, state, dispatcher, logger, storageAccess, params);
			break;
		
		case PlayerActionCode.SET_INGREDIENT:
			handlePlayerActionOfType(context, dispatcher, "set_ingredient", params);
			break;

		case PlayerActionCode.COOK_SUMMON:
			handlePlayerActionOfType(context, dispatcher, "cook_summon", params);
			break;

		case PlayerActionCode.ACTIVATE:
			handlePlayerActionOfType(context, dispatcher, "activate", params);
			break;
		
		case PlayerActionCode.GO_TO_STRIKE_PHASE:
			handlePlayerActionOfType(context, dispatcher, "go_to_strike_phase", params);
			break;
	
		case PlayerActionCode.ATTACK:
			handlePlayerActionOfType(context, dispatcher, "attack", params);
			break;
		
		case PlayerActionCode.END_TURN:
			handlePlayerActionOfType(context, dispatcher, "end_turn", params);
			break;
				
		case PlayerActionCode.RESPOND_CHOICE:
			handlePlayerActionOfType(context, dispatcher, params.type, params);
			context.logger.debug(JSON.stringify(context.gameState))
			if (context.gameState.pauseStatus && context.gameState.pauseStatus.reason === "player_request") {
				context.logger.debug(JSON.stringify(context.gameState.pauseStatus.request.callback.name))
			}
			break;
						
		case PlayerActionCode.SURRENDER:
			handlePlayerActionOfType(context, dispatcher, "surrender", params);
			break;

		case PlayerActionCode.READY:
			handlePlayerActionOfType(context, dispatcher, "ready", params);
			break;
	}
}

function sendErrorToPlayer(dispatcher: MatchMessageDispatcher, playerId: string, error: unknown): void {
	dispatcher.dispatch(MatchEventCode.ERROR, JSON.stringify(error), [playerId])
}

function genericMessageHandler(senderId: string, state: GameState, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, storageAccess: GameStorageAccess, params: any) {
	// Send user message to opponent
	let senderOpponent = Match.getOpponent(state, senderId);
	dispatcher.dispatch(MatchEventCode.MESSAGE, JSON.stringify(params), [senderOpponent], senderId, true);
	return true;
}

function handlePlayerActionOfType(context: ActionHandleContext, dispatcher: MatchMessageDispatcher, type: ActionType, params: any): void {
	let handler = getActionHandler(type)
	if (!handler) {
		context.logger.error("Unknown player action of type: " + type)
		return;
	}
	// auto inject type into params, if it does not exist
	if (params && !params.type) {
		params.type = type
	}
	let result = handler(context, params)
	if (!result.success) {
		sendErrorToPlayer(dispatcher, context.senderId, result.data)
		// log internal error
		if (result.data.error) {
			context.logger.error("Internal error during handle player action: %s", result.data.error?.message);
		}
	}
	context.logger.error("Handled player action of type: " + type)
}