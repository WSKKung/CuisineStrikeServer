/*
CHAT_MESSAGE,
PREGAME_CONFIRM,
COMMIT_ACTION,
SURRENDER
*/
enum PlayerActionCode {
	MESSAGE = 1,
	COMMIT_ACTION = 2,
	SURRENDER = 3,
	END_TURN = 4,
	SET_INGREDIENT = 5,
	SUMMON_DISH = 6,
	ATTACK = 7,
	CHECK_SET_INGREDIENT = 8,
	CHECK_SUMMON_DISH = 9,
	CHECK_ATTACK_TARGET = 10
}

function receivePlayerMessage(state: GameState, senderId: string, opCode: number, msg: string, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger) {
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
			genericMessageHandler(senderId, state, dispatcher, logger, msgParams);

			break;
		case PlayerActionCode.COMMIT_ACTION:
			handlePlayerAction(senderId, state, dispatcher, logger, msgParams);
			break;
	}
}

function genericMessageHandler(senderId: string, state: GameState, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, params: any) {
	// Send user message to opponent
	let senderOpponent = Match.getOpponent(state, senderId);
	dispatcher.dispatch(MatchEventCode.MESSAGE, JSON.stringify(params), [senderOpponent], senderId, true);
	return true;
}

function handlePlayerAction(senderId: string, state: GameState, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, params: any) {
	let actionType: ActionType = params["type"] as ActionType;
	let actionHandler: ActionHandler | null = getActionHandler(actionType)
	if (!actionHandler) {
		return;
	}

	let result: ActionHandlerResult = actionHandler(state, senderId, params);
	if (result.success) {
		state.lastAction = {
			id: Match.newUUID(state),
			type: actionType,
			owner: senderId,
			data: result.data
		};
	}
	else {
		sendToPlayer(dispatcher, MatchEventCode.MESSAGE, { error: true, data: result.data }, senderId);
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