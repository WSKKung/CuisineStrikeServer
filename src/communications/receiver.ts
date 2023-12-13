enum PlayerActionCode {
	MESSAGE = 1,
	END_TURN = 2,
	PLAY_INGREDIENT = 3,
	SUMMON_DISH = 4,
	ATTACK = 5,
	PLAY_ACTION = 6,
	PLAY_TRIGGER = 7,
	ACTIVATE_ABILITY = 8,
	END_GAME = 99
}

// returns bool => true == continue running, false == stop running
type PlayerActionHandlerFunction = (playerId: string, state: GameState, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger, params: {[key: string]: any}) => boolean;
type PlayerActionHandler = {
	[opCode: number]: PlayerActionHandlerFunction
	fallback: PlayerActionHandlerFunction
};

function chain(...handlers: PlayerActionHandlerFunction[]): PlayerActionHandlerFunction {
	return (playerId, state, dispatcher, logger, params) => {
		let shouldContinue: boolean = true;
		for (let handler of handlers) {
			shouldContinue = handler(playerId, state, dispatcher, logger, params);
			if (!shouldContinue) {
				break;
			}
		}
		return shouldContinue;
	};
}

const invalidMessageHandler: PlayerActionHandlerFunction = (playerId, state, dispatcher, logger, params) => {
	dispatcher.dispatch(MatchEventCode.MESSAGE, "Unknown action opcode", [playerId], null, true);
	return true;
};

const checkTurnPlayer: PlayerActionHandlerFunction = (playerId, state, dispatcher, logger, params) => {
	return Match.isPlayerTurn(state, playerId);
};

const genericMessageHandler: PlayerActionHandlerFunction  = (playerId, state, dispatcher, logger, params) => {
	// Send user message to opponent
	let senderOpponent = Match.getOpponent(state, playerId);
	dispatcher.dispatch(MatchEventCode.MESSAGE, JSON.stringify(params), [senderOpponent], playerId, true);
	return true;
};

const endTurnHandler: PlayerActionHandlerFunction = (playerId, state, dispatcher, logger, params) => {
	Match.gotoNextTurn(state);
	Match.getActivePlayers(state).forEach(id => sendEventTurnChanged(state, dispatcher, id));
	return true;
};

const attackHandler: PlayerActionHandlerFunction = (playerId, state, dispatcher, logger, params) => {
	let opponent = Match.getOpponent(state, playerId);
	let opponentOldHP = Match.getHP(state, opponent);
	let damage: number = (params && params.amount) || 0;
	Match.setHP(state, opponent, opponentOldHP - damage);
	Match.getActivePlayers(state).forEach(id => sendEventPlayerHPChanged(state, dispatcher, id));
	return true;
};

function receivePlayerMessage(state: GameState, senderId: string, opCode: number, msg: string, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger) {
	let msgDataObj: any
	try {
		msgDataObj = JSON.parse(msg);
	}
	catch (err) {
		logger.info(`Error parsing data string from message: ${msg}`)
		msgDataObj = {}
	}

	const actionHandlers: PlayerActionHandler = {
		[PlayerActionCode.MESSAGE]: genericMessageHandler,
		[PlayerActionCode.END_TURN]: chain(checkTurnPlayer, endTurnHandler),
		[PlayerActionCode.ATTACK]: chain(checkTurnPlayer, attackHandler),
		fallback: invalidMessageHandler
	};

	let handler = actionHandlers[opCode] || actionHandlers.fallback
	handler(senderId, state, dispatcher, logger, msgDataObj);
}