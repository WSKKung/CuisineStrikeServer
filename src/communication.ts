function receivePlayerMessage(state: GameState, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, msg: nkruntime.MatchMessage) {
	let players = Match.getActivePlayers(state);
	let senderId = getPlayerId(msg.sender);
	let isSenderTurnPlayer = Match.isPlayerTurn(state, senderId);
	let msgDataStr = nk.binaryToString(msg.data);
	let msgDataObj: any
	try {
		msgDataObj = JSON.parse(msgDataStr);
	}
	catch (err) {
		logger.info(`Error parsing data string from message: ${msgDataStr}`)
		msgDataObj = {}
	}
	switch (msg.opCode) {
		// pass messages to opponent
		case MATCH_OPCODE_MSG:
			// Send user message to opponent
			let senderOpponent = Match.getOpponent(state, senderId);
			let senderOpponentPresence = Match.getPresence(state, senderOpponent);
			dispatcher.broadcastMessage(MATCH_OPCODE_MSG, msg.data, senderOpponentPresence && [senderOpponentPresence], msg.sender, true);

			break;
		case MATCH_OPCODE_END_TURN:
			if (!isSenderTurnPlayer) {
				dispatcher.broadcastMessage(MATCH_OPCODE_MSG, "It's not your turn yet!", [msg.sender], null, true);
				break;
			}
			// end turn
			Match.gotoNextTurn(state);
			players.forEach(id => sendEventTurnChanged(state, dispatcher, id));

			break;
		case MATCH_OPCODE_PLAY_INGREDIENT:
			if (!isSenderTurnPlayer) {
				dispatcher.broadcastMessage(MATCH_OPCODE_MSG, "It's not your turn yet!", [msg.sender], null, true);
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
			dispatcher.broadcastMessage(MATCH_OPCODE_MSG, "Unknown action opcode", [msg.sender], null, true);
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

function sendCurrentGameState(state: GameState, dispatcher: nkruntime.MatchDispatcher, playerId: string) {
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
	dispatcher.broadcastMessage(MATCH_OPCODE_MSG, JSON.stringify(gameBeginMsgData), [Match.getPresence(state, playerId)], null, true);
}

function sendEventTurnChanged(state: GameState, dispatcher: nkruntime.MatchDispatcher, playerId: string) {
	let turnEndMsgData = {
		turnCount: state.turnCount,
		isYourTurn: Match.isPlayerTurn(state, playerId)
	};
	dispatcher.broadcastMessage(MATCH_OPCODE_MSG, JSON.stringify(turnEndMsgData), [Match.getPresence(state, playerId)], null, true);
}

function sendEventPlayerHPChanged(state: GameState, dispatcher: nkruntime.MatchDispatcher, playerId: string) {
	let opponent = Match.getOpponent(state, playerId);
	let playerHP = Match.getHP(state, playerId);
	let opponentHP = Match.getHP(state, opponent);
	let hpUpdateMsgData = {
		you: playerHP,
		opponent: opponentHP,
	}
	dispatcher.broadcastMessage(MATCH_OPCODE_MSG, JSON.stringify(hpUpdateMsgData), [Match.getPresence(state, playerId)], null, true);
}

function sendEventGameEnded(state: GameState, dispatcher: nkruntime.MatchDispatcher, playerId: string) {
	let gameEndMsgData = {
		isWinner: state.winner && state.winner === playerId
	};
	dispatcher.broadcastMessage(MATCH_OPCODE_GAME_END, JSON.stringify(gameEndMsgData), [Match.getPresence(state, playerId)], null, true);
}