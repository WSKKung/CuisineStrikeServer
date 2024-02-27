import { CardProperties, Card, CardID, CardType } from "../model/cards";
import { GameEvent, GameEventRequestChoice } from "../model/events";
import { CardLocation } from "../model/cards";
import { GameState, Match } from "../match"
import { PlayerChoiceRequest, PlayerChoiceResponse } from "../model/player_request";
import { MatchMessageDispatcher } from "../wrapper"
import { MatchEventCode } from "./event_codes";

type OptionalCardProperties = {
	[property in keyof CardProperties]?: CardProperties[property]
}

type AvailableTurnActionPacket = {
	actions: Array<AvailableCardActionPacket>
}

type AvailableCardActionPacket = {
	card: CardID,
	set?: {
		required_material_count: number,
		columns: Array<number>
	},
	cook_summon?: {
		can_quick_set: boolean,
		material_combinations: Array<Array<CardID>>,
		columns: Array<number>,
		quick_set_columns: Array<number>
	},
	attack?: {
		can_direct_attack: boolean,
		targets: Array<CardID>
	},
	activate?: {
	}
}

type CardPacket = {
	id: string,
	is_owned: boolean,
	base_properties?: OptionalCardProperties,
	properties?: OptionalCardProperties,
	location: number,
	column: number
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

function localizeSingleCardData(card: Card, state: GameState, playerId: string, forceMode: "public" | "private" | "none" = "none"): CardPacket {
	let isCardOwner = card.owner === playerId;
	let isDataPublicForPlayer = false;

	switch (forceMode) {
		case "none":
			// public zone
			if (Card.hasLocation(card, CardLocation.SERVE_ZONE | CardLocation.STANDBY_ZONE | CardLocation.TRASH)) {
				isDataPublicForPlayer = true;
			}
			// private zone
			else if (Card.hasLocation(card, CardLocation.HAND | CardLocation.RECIPE_DECK) && isCardOwner) {
				isDataPublicForPlayer = true;
			}
			break;
		case "private":
			isDataPublicForPlayer = false;
			break;
		case "public":
			isDataPublicForPlayer = true;
			break;
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

function localizeCardData(cards: Array<Card>, state: GameState, playerId: string, force_mode: "public" | "private" | "none" = "none"): Array<CardPacket> {
	return cards.map(card => localizeSingleCardData(card, state, playerId, force_mode));
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
			hp: Match.getHP(state, playerId),
			//hand: localizeCardData(Match.getCards(state, CardLocation.HAND, playerId), state, playerId),
			//main_deck: localizeCardData(Match.getCards(state, CardLocation.MAIN_DECK, playerId), state, playerId),
			//recipe_deck: localizeCardData(Match.getCards(state, CardLocation.RECIPE_DECK, playerId), state, playerId)
		},
		opponent: {
			hp: Match.getHP(state, opponent),
			//hand: localizeCardData(Match.getCards(state, CardLocation.HAND, opponent), state, playerId),
			//main_deck: localizeCardData(Match.getCards(state, CardLocation.MAIN_DECK, opponent), state, playerId),
			//recipe_deck: localizeCardData(Match.getCards(state, CardLocation.RECIPE_DECK, opponent), state, playerId)
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
					cards: localizeCardData(event.cards, state, playerId),
					reason: event.reason
				}
				sendToPlayer(dispatcher, MatchEventCode.UPDATE_CARD, packet, playerId);
			});
			break;
		
		case "update_hp":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					is_you: playerId === event.player,
					amount: event.amount
				}
				sendToPlayer(dispatcher, MatchEventCode.UPDATE_PLAYER_HP, packet, playerId);
			});
			break;
		
			/*
		case "change_hp":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					is_you: playerId === event.player,
					amount: event.amount
				}
				sendToPlayer(dispatcher, MatchEventCode.UPDATE_PLAYER_HP, packet, playerId);
			});
			break;
			*/

		case "change_phase":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					phase: event.phase
				}
				sendToPlayer(dispatcher, MatchEventCode.CHANGE_PHASE, packet, playerId);
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
					card: localizeSingleCardData(event.card, state, playerId),
					column: event.column,
					materials: []//localizeCardData(Match.findCardsById(state, event.materials), state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.SET_INGREDIENT, packet, playerId);
			});
			break;
	
		case "summon":
			Match.forEachPlayers(state, playerId => {
				let packet: DishSummonPacket = {
					card: localizeSingleCardData(event.card, state, playerId),
					column: event.column,
					materials: []//localizeCardData(Match.findCardsById(state, event.materials), state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.SUMMON_DISH, packet, playerId);
			});
			break;

		case "attack":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					attacker_card: localizeSingleCardData(event.attackingCard, state, playerId),
					target_card: event.isDirect ? undefined : localizeSingleCardData(event.targetCard, state, playerId),
					is_direct_attack: event.isDirect
				};
				sendToPlayer(dispatcher, MatchEventCode.ATTACK, packet, playerId);
			});
			break;

		case "activate":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					card: localizeSingleCardData(event.card, state, playerId, "public"),
					player: event.sourcePlayer
				};
				sendToPlayer(dispatcher, MatchEventCode.ACTIVATE, packet, playerId);
			});
			break;

		case "request_choice":
			sendRequestChoiceAction(state, dispatcher, event.request);
			break;

		case "confirm_choice":
			sendResponseChoiceAction(state, dispatcher, event.response);
			break;
		
		case "destroy":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					cards: localizeCardData(event.cards, state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.DESTROY_CARD, packet, playerId);
			});
			break;
		
		case "discard":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					cards: localizeCardData(event.cards, state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.DISCARD_CARD, packet, playerId);
			});
			break;
		
		case "damage":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					cards: localizeCardData(event.cards, state, playerId),
					amount: event.amount
				};
				sendToPlayer(dispatcher, MatchEventCode.DAMAGE_CARD, packet, playerId);
			});
			break;
		
		case "recycle":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					cards: localizeCardData(event.cards, state, playerId)
				};
				sendToPlayer(dispatcher, MatchEventCode.RECYCLE_CARD, packet, playerId);
			});
			break;
	}
}

export function broadcastMatchEnd(state: GameState, dispatcher: MatchMessageDispatcher) {
	Match.getActivePlayers(state).forEach(playerId => {
		let event = {
			is_winner: Match.isWinner(state, playerId),
			reason: Match.getEndReason(state)
		}
		sendToPlayer(dispatcher, MatchEventCode.END_GAME, event, playerId)
	});
}

export function sendRequestChoiceAction(state: GameState, dispatcher: MatchMessageDispatcher, request: PlayerChoiceRequest) {
	switch (request.type) {
		case "cards":
		Match.forEachPlayers(state, playerId => {
			let packet = {
				type: "cards",
				is_you: playerId === request.playerId,
				hint: request.hint,
				cards: playerId === request.playerId ? localizeCardData(request.cards, state, playerId, "public") : [],
				min: request.min,
				max: request.max
			};
			sendToPlayer(dispatcher, MatchEventCode.REQUEST_CHOICE, packet, playerId);
		})
		break;

		case "zones":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					type: "zones",
					is_you: playerId === request.playerId,
					hint: request.hint,
					zones: playerId === request.playerId ? request.zones.map(z => ({ location: z.location, owned: request.playerId === z.owner, column: z.column })) : [],
					min: request.min,
					max: request.max
				};
				sendToPlayer(dispatcher, MatchEventCode.REQUEST_CHOICE, packet, playerId);
			})
			break;
		
		case "yes_no":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					type: "yes_no",
					is_you: playerId === request.playerId,
					hint: request.hint
				};
				sendToPlayer(dispatcher, MatchEventCode.REQUEST_CHOICE, packet, playerId);
			})
			break;
		
		case "option":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					type: "option",
					is_you: playerId === request.playerId,
					hint: request.hint,
					options: request.options
				};
				sendToPlayer(dispatcher, MatchEventCode.REQUEST_CHOICE, packet, playerId);
			})
			break;
	}
}

export function sendResponseChoiceAction(state: GameState, dispatcher: MatchMessageDispatcher, response: PlayerChoiceResponse) {
	switch (response.type) {
		case "cards":
		Match.forEachPlayers(state, playerId => {
			let packet = {
				type: "cards",
				is_you: playerId === response.playerId,
				hint: response.hint,
				cards: localizeCardData(response.choice, state, playerId, "public"),
			};
			sendToPlayer(dispatcher, MatchEventCode.RESPOND_CHOICE, packet, playerId);
		})
		break;

		case "zones":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					type: "zones",
					is_you: playerId === response.playerId,
					hint: response.hint,
					zones: response.choice.map(z => ({ location: z.location, owned: response.playerId === z.owner, column: z.column }))
				};
				sendToPlayer(dispatcher, MatchEventCode.RESPOND_CHOICE, packet, playerId);
			})
			break;
		
		case "yes_no":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					type: "yes_no",
					is_you: playerId === response.playerId,
					hint: response.hint,
					yes: response.choice
				};
				sendToPlayer(dispatcher, MatchEventCode.RESPOND_CHOICE, packet, playerId);
			})
			break;
		
		case "option":
			Match.forEachPlayers(state, playerId => {
				let packet = {
					type: "option",
					is_you: playerId === response.playerId,
					hint: response.hint,
					option: response.choice
				};
				sendToPlayer(dispatcher, MatchEventCode.RESPOND_CHOICE, packet, playerId);
			})
			break;
	}
}

export function broadcastUpdateAvailabeActions(state: GameState, dispatcher: MatchMessageDispatcher) {
	Match.getActivePlayers(state).forEach(playerId => {
		let actionMap: { [card: CardID]: AvailableCardActionPacket } = {};
		// set
		let potentialSettableCards = Match.findCards(state, (card) =>  Match.isCardCanSetAsIngredient(state, card), CardLocation.HAND, playerId);
		for (let card of potentialSettableCards) {
			let requiredCost = Card.getIngredientMinimumMaterialCost(card);
			if (requiredCost >= 0) {
				let potentialMaterialCount = Match.countCards(state, CardLocation.STANDBY_ZONE, playerId);
				if (requiredCost <= potentialMaterialCount) {
					actionMap[card.id] = actionMap[card.id] || { card: card.id };
					actionMap[card.id].set = { required_material_count: requiredCost, columns: [0,1,2] }
				}
			}
			else {
				let freeColumns = Match.getFreeColumns(state, playerId, CardLocation.STANDBY_ZONE);
				if (freeColumns.length > 0) {
					actionMap[card.id] = actionMap[card.id] || { card: card.id };
					actionMap[card.id].set = { required_material_count: requiredCost, columns: freeColumns }
				}
			}
		}

		// cook summon
		let potentialCookableCards = Match.findCards(state, (card) =>  Match.isCardCanCookSummon(state, card), CardLocation.RECIPE_DECK, playerId);
		for (let card of potentialCookableCards) {
			actionMap[card.id] = actionMap[card.id] || { card: card.id };
			actionMap[card.id].cook_summon = {
				material_combinations: [],
				columns: [],
				can_quick_set: Card.hasType(card, CardType.INGREDIENT),
				quick_set_columns: []
			}
		}

		// attack
		let potentialAttackableCards = Match.findCards(state, (card) =>  Match.isCardCanAttack(state, card), CardLocation.SERVE_ZONE, playerId);
		let validAttackTargets = Match.getCards(state, CardLocation.SERVE_ZONE, Match.getOpponent(state, playerId));
		for (let card of potentialAttackableCards) {
			actionMap[card.id] = actionMap[card.id] || { card: card.id };
			actionMap[card.id].attack = {
				can_direct_attack: validAttackTargets.length <= 0,
				targets: validAttackTargets.map(c => c.id)
			}
		}

		// activate
		let potentialActivateableCards = Match.findCards(state, (card) =>  Match.isCardCanActivateAbility(state, card), CardLocation.HAND | CardLocation.ON_FIELD, playerId);
		for (let card of potentialActivateableCards) {
			actionMap[card.id] = actionMap[card.id] || { card: card.id };
			actionMap[card.id].activate = {}
		}

		let packet: AvailableTurnActionPacket = {
			actions: Object.values(actionMap)
		};

		//state.log?.debug(JSON.stringify(actionMap));
		sendToPlayer(dispatcher, MatchEventCode.UPDATE_AVAILABLE_ACTIONS, packet, playerId)
	});
}