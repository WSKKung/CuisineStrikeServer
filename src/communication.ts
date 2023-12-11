function receivePlayerMessage(state: GameState, senderId: string, opCode: number, msg: string, dispatcher: MatchMessageDispatcher, logger: nkruntime.Logger) {
	let players = Match.getActivePlayers(state);
	let isSenderTurnPlayer = Match.isPlayerTurn(state, senderId);
	let msgDataObj: any
	try {
		msgDataObj = JSON.parse(msg);
	}
	catch (err) {
		logger.info(`Error parsing data string from message: ${msg}`)
		msgDataObj = {}
	}
	switch (opCode) {
		// pass messages to opponent
		case PlayerActionCode.MESSAGE:
			// Send user message to opponent
			let senderOpponent = Match.getOpponent(state, senderId);
			dispatcher.dispatch(MATCH_OPCODE_MSG, msg, [senderOpponent], senderId, true);

			break;
		case PlayerActionCode.END_TURN:
			if (!isSenderTurnPlayer) {
				dispatcher.dispatch(MATCH_OPCODE_MSG, "It's not your turn yet!", [senderId], null, true);
				break;
			}
			// end turn
			Match.gotoNextTurn(state);
			players.forEach(id => sendEventTurnChanged(state, dispatcher, id));

			break;
		case PlayerActionCode.ATTACK:
			if (!isSenderTurnPlayer) {
				dispatcher.dispatch(MATCH_OPCODE_MSG, "It's not your turn yet!", [senderId], null, true);
				break;
			}
		
			let opponent = Match.getOpponent(state, senderId);
			let opponentOldHP = Match.getHP(state, opponent);
			let damage = (msgDataObj && msgDataObj.amount) || 1;
			Match.setHP(state, opponent, opponentOldHP - damage);
			let opponentNewHP = Match.getHP(state, opponent);
			players.forEach(id => sendEventPlayerHPChanged(state, dispatcher, id));

			break;
		default:
			dispatcher.dispatch(MatchEventCode.MESSAGE, "Unknown action opcode", [senderId], null, true);
	}
}

function serializePrivateCardData(card: Card): Object {
	return {
		id: card.id
	};
}

function serializePublicCardData(card: Card): Object {
	return {
		id: card.id,
		base_properties: card.base_properties,
		properties: card.properties
	};
}

function sendCurrentGameState(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let opponent = Match.getOpponent(state, playerId);
	let gameBeginMsgData = {
		turnCount: state.turnCount,
		isYourTurn: state.turnPlayer === playerId,
		you: {
			hp: Match.getPlayer(state, playerId).hp,
			hand: Match.getCards(state, CardLocation.MAIN_DECK, playerId).map(serializePublicCardData),
			mainDeck: Match.getCards(state, CardLocation.MAIN_DECK, playerId).map(serializePrivateCardData)
		},
		opponent: {
			hp: Match.getPlayer(state, opponent).hp,
			hand: Match.getCards(state, CardLocation.MAIN_DECK, opponent).map(serializePrivateCardData),
			mainDeck: Match.getCards(state, CardLocation.MAIN_DECK, opponent).map(serializePrivateCardData)
		}
	};
	dispatcher.dispatch(MATCH_OPCODE_MSG, JSON.stringify(gameBeginMsgData), [playerId], null, true);
}

function sendEventTurnChanged(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let turnEndMsgData = {
		turnCount: state.turnCount,
		isYourTurn: Match.isPlayerTurn(state, playerId)
	};
	dispatcher.dispatch(MATCH_OPCODE_MSG, JSON.stringify(turnEndMsgData), [playerId], null, true);
}

function sendEventPlayerHPChanged(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let opponent = Match.getOpponent(state, playerId);
	let playerHP = Match.getHP(state, playerId);
	let opponentHP = Match.getHP(state, opponent);
	let hpUpdateMsgData = {
		you: playerHP,
		opponent: opponentHP,
	}
	dispatcher.dispatch(MATCH_OPCODE_MSG, JSON.stringify(hpUpdateMsgData), [playerId], null, true);
}

function sendEventGameEnded(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let gameEndMsgData = {
		isWinner: state.winner && state.winner === playerId
	};
	dispatcher.dispatch(MATCH_OPCODE_GAME_END, JSON.stringify(gameEndMsgData), [playerId], null, true);
}