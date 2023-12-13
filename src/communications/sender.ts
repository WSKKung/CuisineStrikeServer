enum MatchEventCode {
	MESSAGE = 1,
	END_TURN = 2,
	ATTACK = 5,
	UPDATE_STATE = 51,
	END_GAME = 99
}

type OptionalCardProperties = {
	[property in keyof CardProperties]?: CardProperties[property]
}

type CardPacket = {
	id: string,
	base_properties?: OptionalCardProperties,
	properties?: OptionalCardProperties
}

interface UpdateGameStatePacket {
	turn_count: number,
	is_your_turn: boolean,
	you: {
		username: string,
		hp: number,
		hand: Array<CardPacket>,
		main_deck: Array<CardPacket>,
		recipe_deck: Array<CardPacket>
	},
	opponent: {
		username: string,
		hp: number,
		hand: Array<CardPacket>,
		main_deck: Array<CardPacket>,
		recipe_deck: Array<CardPacket>
	}
}

interface TurnChangePacket {
	turn_count: number,
	is_your_turn: boolean
}

interface AttackPacket {
	attacker_card: string,
	target_card?: string,
	you: {
		hp: number
	},
	opponent: {
		hp: number
	}
}

interface GameEndPacket {
	is_winner: boolean
}

function serializePrivateCardData(card: Card): CardPacket {
	return {
		id: card.id
	};
}

function serializePublicCardData(card: Card): CardPacket {
	return {
		id: card.id,
		base_properties: card.base_properties,
		properties: card.properties
	};
}

function sendCurrentGameState(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let opponent = Match.getOpponent(state, playerId);
	let gameBeginMsgData: UpdateGameStatePacket = {
		turn_count: state.turnCount,
		is_your_turn: Match.isPlayerTurn(state, playerId),
		you: {
			username: Match.getPresence(state, playerId).username,
			hp: Match.getPlayer(state, playerId).hp,
			hand: Match.getCards(state, CardLocation.HAND, playerId).map(serializePublicCardData),
			main_deck: Match.getCards(state, CardLocation.MAIN_DECK, playerId).map(serializePrivateCardData),
			recipe_deck: Match.getCards(state, CardLocation.MAIN_DECK, playerId).map(serializePrivateCardData)
		},
		opponent: {
			username: Match.getPresence(state, opponent).username,
			hp: Match.getPlayer(state, opponent).hp,
			hand: Match.getCards(state, CardLocation.HAND, opponent).map(serializePrivateCardData),
			main_deck: Match.getCards(state, CardLocation.MAIN_DECK, opponent).map(serializePrivateCardData),
			recipe_deck: Match.getCards(state, CardLocation.MAIN_DECK, playerId).map(serializePrivateCardData)
		}
	};
	dispatcher.dispatch(MatchEventCode.UPDATE_STATE, JSON.stringify(gameBeginMsgData), [playerId], null, true);
}

function sendEventTurnChanged(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let turnEndMsgData: TurnChangePacket = {
		turn_count: state.turnCount,
		is_your_turn: Match.isPlayerTurn(state, playerId)
	};
	dispatcher.dispatch(MatchEventCode.END_TURN, JSON.stringify(turnEndMsgData), [playerId], null, true);
}

function sendEventPlayerHPChanged(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let opponent = Match.getOpponent(state, playerId);
	let playerHP = Match.getHP(state, playerId);
	let opponentHP = Match.getHP(state, opponent);
	let attackMsgData: AttackPacket = {
		attacker_card: "",
		you: {
			hp: playerHP
		},
		opponent: {
			hp: opponentHP
		},
	}
	dispatcher.dispatch(MatchEventCode.ATTACK, JSON.stringify(attackMsgData), [playerId], null, true);
}

function sendEventGameEnded(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let gameEndMsgData: GameEndPacket = {
		is_winner: Match.isWinner(state, playerId)
	};
	dispatcher.dispatch(MatchEventCode.END_GAME, JSON.stringify(gameEndMsgData), [playerId], null, true);
}