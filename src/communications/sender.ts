enum MatchEventCode {
	MESSAGE = 1,
	UPDATE_STATE = 2,
	UPDATE_ACTION_POOL = 3,
	CHANGE_TURN = 4,
	SET_INGREDIENT = 5,
	SUMMON_DISH = 5,
	ATTACK = 6,
	END_GAME = 99
}

type OptionalCardProperties = {
	[property in keyof CardProperties]?: CardProperties[property]
}

type CardPacket = {
	id: string,
	is_owned: boolean,
	base_properties?: OptionalCardProperties,
	properties?: OptionalCardProperties,
	location: number,
	column: number
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

interface IngredientSetPacket {
	card: CardPacket,
	column: number,
	materials: Array<CardPacket>
}

interface DrawCardPacket {
	you: {
		amount: number
	},
	opponent: {
		amount: number
	}
}

interface AttackPacket {
	attacker_card: string,
	target_card?: string,
	is_direct_attack: boolean,
	destroyed_cards: Array<string>
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

function localizeSingleCardData(card: Card, state: GameState, playerId: string): CardPacket {
	let isCardOwner = card.owner === playerId;
	let isDataPublicForPlayer = false;

	// public zone
	if (Card.hasLocation(card, CardLocation.SERVE_ZONE | CardLocation.STANDBY_ZONE | CardLocation.TRASH)) {
		isDataPublicForPlayer = true;
	}
	// private zone
	else if (Card.hasLocation(card, CardLocation.HAND | CardLocation.RECIPE_DECK) && isCardOwner) {
		isDataPublicForPlayer = true;
	}

	if (isDataPublicForPlayer) {
		return {
			id: card.id,
			is_owned: isCardOwner,
			base_properties: card.base_properties,
			properties: card.properties,
			location: Card.getLocation(card),
			column: Card.getColumn(card)
		};
	}
	else {
		return {
			id: card.id,
			is_owned: isCardOwner,
			location: Card.getLocation(card),
			column: Card.getColumn(card)
		};
	}
}

function localizeCardData(cards: Array<Card>, state: GameState, playerId: string): Array<CardPacket> {
	return cards.map(card => localizeSingleCardData(card, state, playerId));
}

function sendToPlayer(dispatcher: MatchMessageDispatcher, opCode: number, dataObject: Object, playerId: string) {
	dispatcher.dispatch(opCode, JSON.stringify(dataObject), [playerId], null, true);
}

function deferSendToPlayer(dispatcher: MatchMessageDispatcher, opCode: number, dataObject: Object, playerId: string) {
	dispatcher.dispatchDeferred(opCode, JSON.stringify(dataObject), [playerId], null, true);
}

function broadcastMatchState(state: GameState, dispatcher: MatchMessageDispatcher) {
	Match.getActivePlayers(state).forEach(playerId => {
		let opponent = Match.getOpponent(state, playerId);
		let event: UpdateGameStatePacket = {
			turn_count: state.turnCount,
			is_your_turn: Match.isPlayerTurn(state, playerId),
			you: {
				username: Match.getPresence(state, playerId).username,
				hp: Match.getPlayer(state, playerId).hp,
				hand: localizeCardData(Match.getCards(state, CardLocation.HAND, playerId), state, playerId),
				main_deck: localizeCardData(Match.getCards(state, CardLocation.MAIN_DECK, playerId), state, playerId),
				recipe_deck: localizeCardData(Match.getCards(state, CardLocation.RECIPE_DECK, playerId), state, playerId)
			},
			opponent: {
				username: Match.getPresence(state, opponent).username,
				hp: Match.getPlayer(state, opponent).hp,
				hand: localizeCardData(Match.getCards(state, CardLocation.HAND, opponent), state, playerId),
				main_deck: localizeCardData(Match.getCards(state, CardLocation.MAIN_DECK, opponent), state, playerId),
				recipe_deck: localizeCardData(Match.getCards(state, CardLocation.RECIPE_DECK, opponent), state, playerId)
			}
		};
		sendToPlayer(dispatcher, MatchEventCode.UPDATE_STATE, event, playerId)
	});
}

function broadcastMatchActionEvent(state: GameState, dispatcher: MatchMessageDispatcher, action: ActionResult) {
	switch (action.type) {
		case "end_turn":
			Match.getActivePlayers(state).forEach(playerId => {
				let event: TurnChangePacket = {
					turn_count: state.turnCount,
					is_your_turn: Match.isPlayerTurn(state, playerId)
				}
				sendToPlayer(dispatcher, MatchEventCode.CHANGE_TURN, event, playerId)
			});
			break;
		case "set_ingredient":
			Match.getActivePlayers(state).forEach(playerId => {
				let event: IngredientSetPacket = {
					card: localizeSingleCardData(Match.findCardByID(state, action.data.card)!, state, playerId),
					column: action.data.column,
					materials: localizeCardData(Match.findCardsById(state, action.data.materials), state, playerId)
				}
				sendToPlayer(dispatcher, MatchEventCode.SET_INGREDIENT, event, playerId)
			});
	}
}

function broadcastMatchEnd(state: GameState, dispatcher: MatchMessageDispatcher) {
	Match.getActivePlayers(state).forEach(playerId => {
		let event = {
			is_winner: Match.isWinner(state, playerId),
			reason: Match.getEndReason(state)
		}
		sendToPlayer(dispatcher, MatchEventCode.END_GAME, event, playerId)
	});
}