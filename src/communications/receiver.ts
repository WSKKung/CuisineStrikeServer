import { error } from "console";
import { getActionHandler, ActionHandlerResult, ActionHandleContext, ActionHandleFunction } from "../action_handler";
import { ActionType, getPlayerActionSchemaByType } from "../action_schema";
import { GameState, Match } from "../match";
import { MatchMessageDispatcher, GameStorageAccess } from "../wrapper";
import { MatchEventCode, PlayerActionCode } from "./event_codes";
import { sendToPlayer } from "./sender";

export function receivePlayerMessage(state: GameState, senderId: string, opCode: number, msg: string, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, storageAccess: GameStorageAccess) {
	// parse message payload
	let msgParams: any
	try {
		msgParams = JSON.parse(msg);
	}
	catch (err) {
		logger.info(`Error parsing data string from message: ${msg}`);
		msgParams = {};
	}

	switch (opCode) {
		case PlayerActionCode.MESSAGE:
			genericMessageHandler(senderId, state, dispatcher, logger, storageAccess, msgParams);

			break;
		case PlayerActionCode.COMMIT_ACTION:
			handlePlayerAction(senderId, state, dispatcher, logger, storageAccess, msgParams);
			break;
	}
}

function genericMessageHandler(senderId: string, state: GameState, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, storageAccess: GameStorageAccess, params: any) {
	// Send user message to opponent
	let senderOpponent = Match.getOpponent(state, senderId);
	dispatcher.dispatch(MatchEventCode.MESSAGE, JSON.stringify(params), [senderOpponent], senderId, true);
	return true;
}

function handlePlayerAction(senderId: string, state: GameState, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, storageAccess: GameStorageAccess, params: any) {
	let actionType: ActionType = params["type"] as ActionType;
	let actionHandler: ActionHandleFunction | null = getActionHandler(actionType)
	if (!actionHandler) {
		return;
	}

	let context: ActionHandleContext = {
		storageAccess: storageAccess,
		gameState: state,
		senderId: senderId
	};
	let result: ActionHandlerResult = actionHandler(context, params);
	if (!result.success) {
		sendToPlayer(dispatcher, MatchEventCode.ERROR, { reason: result.data.reason, message: result.data.error?.message || "(unspecified)" }, senderId);
		// log internal error
		if (result.data.error) {
			logger.error("Internal error during handle player action: %s", result.data.error?.message);
		}
		return;
	}

	/** 
	let actionId: string = params["id"];
	let action = Match.findActionById(state, senderId, actionId);
	// Handle non-existence action
	if (!action) {
		return;
	}
	const actionHandlers: PlayerActionHandler = {
		[MatchActionType.END_TURN]: endTurnHandler,
		[MatchActionType.SET_INGREDIENT]: setIngredientHandler,
		[MatchActionType.ATTACK]: attackHandler,
		[MatchActionType.DISH_SUMMON]: endTurnHandler
	};
	let typeString: string = action.type; //params["type"];
	let matchActionTypes: MatchActionType[] = (<MatchActionType[]>(<any>Object).values(MatchActionType))
	let type: MatchActionType | undefined = undefined;
	for (let matchActionType of matchActionTypes) {
		if (matchActionType === typeString) {
			type = matchActionType;
			break;
		}
	}
	if (!type) {
		logger.warn("Invalid player action: handler with type " + type + " (" + typeString + ") does not exist!");
		return;
	}
	let handler = actionHandlers[type];
	handler(senderId, state, dispatcher, logger, params);
	*/
}