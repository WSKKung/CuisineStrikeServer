import { CardProperties, Card } from "../card"
import { GameEvent } from "../event_queue"
import { CardLocation } from "../card";
import { GameState, Match } from "../match"
import { MatchMessageDispatcher } from "../wrapper"
import { MatchEventCode } from "./event_codes";

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
		//username: string,
		hp: number,
		hand: Array<CardPacket>,
		main_deck: Array<CardPacket>,
		recipe_deck: Array<CardPacket>
	},
	opponent: {
		//username: string,
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

interface DishSummonPacket {
	card: CardPacket,
	column: number,
	materials: Array<CardPacket>
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
			base_properties: card.baseProperties,
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

export function sendToPlayer(dispatcher: MatchMessageDispatcher, opCode: number, dataObject: Object, playerId: string) {
	dispatcher.dispatch(opCode, JSON.stringify(dataObject), [playerId], null, true);
}

export function deferSendToPlayer(dispatcher: MatchMessageDispatcher, opCode: number, dataObject: Object, playerId: string) {
	dispatcher.dispatchDeferred(opCode, JSON.stringify(dataObject), [playerId], null, true);
}

export function sendCurrentMatchState(state: GameState, dispatcher: MatchMessageDispatcher, playerId: string) {
	let opponent = Match.getOpponent(state, playerId);
	let event = {
		turn_count: state.turnCount,
		is_your_turn: Match.isPlayerTurn(state, playerId),
		cards: localizeCardData(Match.getCards(state, CardLocation.ANYWHERE), state, playerId),
		you: {
			hp: Match.getPlayer(state, playerId).hp,
			hand: localizeCardData(Match.getCards(state, CardLocation.HAND, playerId), state, playerId),
			main_deck: localizeCardData(Match.getCards(state, CardLocation.MAIN_DECK, playerId), state, playerId),
			recipe_deck: localizeCardData(Match.getCards(state, CardLocation.RECIPE_DECK, playerId), state, playerId)
		},
		opponent: {
			hp: Match.getPlayer(state, opponent).hp,
			hand: localizeCardData(Match.getCards(state, CardLocation.HAND, opponent), state, playerId),
			main_deck: localizeCardData(Match.getCards(state, CardLocation.MAIN_DECK, opponent), state, playerId),
			recipe_deck: localizeCardData(Match.getCards(state, CardLocation.RECIPE_DECK, opponent), state, playerId)
		}
	};
	sendToPlayer(dispatcher, MatchEventCode.UPDATE_STATE, event, playerId)
}

export function broadcastMatchState(state: GameState, dispatcher: MatchMessageDispatcher) {
	Match.getActivePlayers(state).forEach(playerId => {
		sendCurrentMatchState(state, dispatcher, playerId);
	});
}

export function broadcastMatchEvent(state: GameState, dispatcher: MatchMessageDispatcher, event: GameEvent) {
	switch (event.type) {
		case "update_card":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					cards: localizeCardData(Match.findCardsById(state, event.cards), state, playerId),
					reason: event.reason
				}
				sendToPlayer(dispatcher, MatchEventCode.UPDATE_CARD, packet, playerId);
			});
			break;
		
		case "update_hp":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					you: Match.getHP(state, playerId),
					opponent: Match.getHP(state, Match.getOpponent(state, playerId))
				}
				sendToPlayer(dispatcher, MatchEventCode.UPDATE_PLAYER_HP, packet, playerId);
			});
			break;


		case "change_turn":
			Match.forEachPlayers(state, playerId => {
				let packet: TurnChangePacket = {
					turn_count: event.turn,
					is_your_turn: playerId === event.turnPlayer
				}
				sendToPlayer(dispatcher, MatchEventCode.CHANGE_TURN, packet, playerId);
			});
			break;

		case "set":
			Match.forEachPlayers(state, playerId => {
				let packet: IngredientSetPacket = {
					card: localizeSingleCardData(Match.findCardByID(state, event.card)!, state, playerId),
					column: event.column,
					materials: []//localizeCardData(Match.findCardsById(state, event.materials), state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.SET_INGREDIENT, packet, playerId);
			});
			break;
	
		case "summon":
			Match.forEachPlayers(state, playerId => {
				let packet: DishSummonPacket = {
					card: localizeSingleCardData(Match.findCardByID(state, event.card)!, state, playerId),
					column: event.column,
					materials: []//localizeCardData(Match.findCardsById(state, event.materials), state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.SUMMON_DISH, packet, playerId);
			});
			break;

		case "discard":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					cards: localizeCardData(Match.findCardsById(state, event.cards), state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.DISCARD_CARD, packet, playerId);
			});
			break;

		case "to_hand":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					cards: localizeCardData(Match.findCardsById(state, event.cards), state, playerId),
					is_you: playerId === event.sourcePlayer
				};
				sendToPlayer(dispatcher, MatchEventCode.ADD_CARD_TO_HAND, packet, playerId);
			});
			break;
	}
}

/*
function broadcastMatchActionEvent(state: GameState, dispatcher: MatchMessageDispatcher, action: ActionResult) {
	switch (action.type) {
		case "end_turn":
			Match.getActivePlayers(state).forEach(playerId => {
				let event: TurnChangePacket = {
					turn_count: state.turnCount,
					is_your_turn: Match.isPlayerTurn(state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.CHANGE_TURN, event, playerId);
			});
			break;

		case "set_ingredient":
			Match.getActivePlayers(state).forEach(playerId => {
				let event: IngredientSetPacket = {
					card: localizeSingleCardData(Match.findCardByID(state, action.data.card)!, state, playerId),
					column: action.data.column,
					materials: localizeCardData(Match.findCardsById(state, action.data.materials), state, playerId)
				};
				state.log?.debug(JSON.stringify(event));
				sendToPlayer(dispatcher, MatchEventCode.SET_INGREDIENT, event, playerId);
			});
			break;

		case "summon_dish":
			Match.getActivePlayers(state).forEach(playerId => {
				let event: DishSummonPacket = {
					card: localizeSingleCardData(Match.findCardByID(state, action.data.card)!, state, playerId),
					column: action.data.column,
					materials: localizeCardData(Match.findCardsById(state, action.data.materials), state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.SUMMON_DISH, event, playerId);
			});
			break;
	}
}
*/

export function broadcastMatchEnd(state: GameState, dispatcher: MatchMessageDispatcher) {
	Match.getActivePlayers(state).forEach(playerId => {
		let event = {
			is_winner: Match.isWinner(state, playerId),
			reason: Match.getEndReason(state)
		}
		sendToPlayer(dispatcher, MatchEventCode.END_GAME, event, playerId)
	});
}