import { Card, CardLocation, CardType } from "./model/cards";
import { receivePlayerMessage } from "./communications/receiver";
import { broadcastMatchState, broadcastMatchEvent, broadcastMatchEnd, broadcastUpdateAvailabeActions, sendRequestChoiceAction, sendResponseChoiceAction } from "./communications/sender";
import { GameEventListener, GameEventType, createGameEventListener } from "./event_queue";
import { EventReason, GameEvent } from "./model/events";
import { GameState, Match, getPlayerId } from "./match";
import { createNakamaIDGenerator, createNakamaMatchDispatcher, NakamaAdapter } from "./wrapper";
import { GameConfiguration } from "./constants";
import { Utility } from "./utility";
import { GameEventHandler, createEventHandler, setupBaseMechanicsEventHandler } from "./event_handler";
import { registerCardEffectScripts } from "./scripts";
import { Deck } from "./model/decks";
import { CardEffect, CardEffectProvider } from "./model/effect";
import { EndResultStringKeys } from "./communications/string_keys";

export type PlayerPresences = {[playerId: string]: nkruntime.Presence | undefined}

// Match created
const matchInit: nkruntime.MatchInitFunction = function(ctx, logger, nk, params) {
	let gameState: GameState = Match.createState();
	let presences: PlayerPresences = {};
	
	let label = "";
	logger.info(`Match created`)
	return {
		state: {
			gameState,
			presences
		},
		tickRate: GameConfiguration.tickRate,
		label
	};
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
	let gameState: GameState = state.gameState;
	let presences: PlayerPresences = state.presences;

	let joinedPlayerId = getPlayerId(presence);
	// match is not started yet 
	if (gameState.status === "init") {
		// reject already joined player
		if (Match.hasPlayer(gameState, joinedPlayerId)) {
			return {
				state: {
					gameState,
					presences,
				},
				accept: false,
				rejectMessage: "Player already joined"
			};
		}
	}
	// match is started
	else {
		// reject other player except player that has joined before the game started
		if (!Match.hasPlayer(gameState, joinedPlayerId)) {
			return {
				state: {
					gameState,
					presences,
				},
				accept: false,
				rejectMessage: "Match already started"
			};
		}
	}
	
	logger.info(`Player ${joinedPlayerId} attempted to join a match`)
	return {
		state: {
			gameState,
			presences,
		},
		accept: true
	};
};

const matchJoin: nkruntime.MatchJoinFunction = function(ctx, logger, nk, dispatcher, tick, state, presences) {
	let gameState: GameState = state.gameState;
	let currentPresences: PlayerPresences = state.presences;
	logger.info(`Player ${presences.map(getPlayerId).join(", ")} joined a match`);
	presences.forEach(presence => {
		let playerId = getPlayerId(presence);
		Match.addPlayer(gameState, playerId);
		Match.setPlayerOnline(gameState, playerId, true);
		currentPresences[playerId] = presence;
		//Match.setPresence(gameState, pId, p);
	});
	return {
		state: {
			gameState,
			presences: currentPresences
		},
	};
};

const matchLeave: nkruntime.MatchLeaveFunction = function(ctx, logger, nk, dispatcher, tick, state, presences) {
	let gameState: GameState = state.gameState;
	let currentPresences: PlayerPresences = state.presences;
	logger.info(`Player ${presences.map(getPlayerId).join(", ")} left a match`);
	presences.forEach(presence => {
		let playerId = getPlayerId(presence);
		Match.setPlayerOnline(gameState, playerId, false);
		currentPresences[playerId] = undefined;
		//Match.removePresence(gameState, pId);
	});
	return {
		state: {
			gameState,
			presences: currentPresences
		},
	};
};

const matchLoop: nkruntime.MatchLoopFunction = function(ctx, logger, nk, dispatcher, tick, state, messages) {
	let gameState: GameState = state.gameState;
	let presences: PlayerPresences = state.presences;
	let eventHandler: GameEventHandler = state.eventHandler;
	gameState.log = logger;
	gameState.nk = nk;
	let idGen = createNakamaIDGenerator(nk);
	let matchDispatcher = createNakamaMatchDispatcher(dispatcher, presences);
	let gameStorageAccess = NakamaAdapter.storageAccess({ nk, logger });
	let players = Match.getActivePlayers(gameState);
	
	switch (gameState.status) {
		case "init":
			// wait until all players join the game
			if (players.length >= 2) {

				// initialize deck
				players.forEach(id => {
					// main deck
					// TODO: Use player's selected deck from database instead
					let deckCards: Array<Card> = [];
					let handCards: Array<Card> = [];
					let deck: Deck = gameStorageAccess.readPlayerActiveDeck(id);
					try {
						deckCards = deck.main.map(entry => {
							let cardId = idGen.uuid();
							let cardProps = gameStorageAccess.readCardProperty(entry.code);
							return Card.create(cardId, entry.code, id, cardProps)
						});

						// shuffle
						Utility.shuffle(deckCards);

						handCards = deckCards.splice(0, GameConfiguration.initialHandSize);
					} catch (error: any) {
						logger.error(`Main deck initialization for player %s failed: %s`, id, error.message);
					}

					// recipe deck
					// TODO: Use player's selected deck from database instead
					let recipeDeckCards: Array<Card> = [];
					try {
						recipeDeckCards = deck.recipe.map(entry => {
							let cardId = idGen.uuid();
							let cardProps = gameStorageAccess.readCardProperty(entry.code);
							return Card.create(cardId, entry.code, id, cardProps)
						});
						recipeDeckCards.forEach(card => Match.addCard(gameState, card));
					} catch (error: any) {
						logger.error(`Recipe deck initialization for player %s failed: %s`, id, error.message);
					}

					Match.moveCard(gameState, handCards, CardLocation.HAND, id);
					Match.moveCard(gameState, deckCards, CardLocation.MAIN_DECK, id);
					Match.moveCard(gameState, recipeDeckCards, CardLocation.RECIPE_DECK, id);

					let addedCards = handCards.concat(deckCards).concat(recipeDeckCards);
					addedCards.forEach(card => Match.addCard(gameState, card));
					Match.updateCards(gameState, handCards.concat(deckCards).concat(recipeDeckCards), EventReason.UNSPECIFIED, "");
				});

			}

			// register effect scripts
			registerCardEffectScripts();
			
			for (let cardId in gameState.cards) {
				let card: Card = gameState.cards[cardId];
				let effects = CardEffectProvider.getEffects(Card.getCode(card));
				for (let effect of effects) {
					Match.registerEffect(gameState, card, effect);
				}				
			}


			// initialize gamestate
			gameState.status = "running";
			gameState.turnPlayer = Match.getRandomPlayer(gameState)
			gameState.turnCount = 1
			broadcastMatchState(gameState, matchDispatcher);
			//broadcastUpdateAvailabeActions(gameState, matchDispatcher);

			Match.beginTurn(gameState)
			
			break;

		case "running":	

			// end game if no enough player to play the game
			if (players.length < 2) {
				// make remaining player wins the game
				gameState.status = "ended";
				gameState.endResult = {
					winners: players,
					reason: EndResultStringKeys.DISCONNECTED
				}
				break;
			}


			// read player messages
			// TODO: Restrict to one command every tick?
			messages.forEach(msg => {
				let senderId = getPlayerId(msg.sender);
				let opCode = msg.opCode;
				let dataStr = nk.binaryToString(msg.data);
				receivePlayerMessage(gameState, senderId, opCode, dataStr, matchDispatcher, logger, gameStorageAccess);
			});

			if (gameState.activeRequest) {
				if (gameState.activeRequest.response) {
					logger.debug("send response choice action")
					sendResponseChoiceAction(gameState, matchDispatcher, gameState.activeRequest.response);
					gameState.activeRequest = null;
				}
				else if (!gameState.activeRequest.dispatched) {
					logger.debug("send request choice action")
					sendRequestChoiceAction(gameState, matchDispatcher, gameState.activeRequest.request);
					gameState.activeRequest.dispatched = true;
				}
			}
			
			if (!gameState.activeRequest) {
				// copy event queue from game state
				let currentEventQueue = [ ...gameState.eventQueue ];
				// clear current event queue for upcoming events
				gameState.eventQueue.splice(0);

				if (!!gameState.prevEventQueueSizeEmpty || (currentEventQueue.length !== 0)) {
					logger.debug(currentEventQueue.map<string>(e => e.event.type).reduce((e1, e2) => e1 + " " + e2, ""))
				}
				gameState.prevEventQueueSizeEmpty = currentEventQueue.length === 0;

				if (currentEventQueue.length > 0) {
					// announce event
					for (let entry of currentEventQueue) {
						if (entry.event.canceled) {
							entry.reject();
						}
						else {
							entry.resolve();
						}
						gameState.resolvedEventQueue.push(entry);
					}
					currentEventQueue = currentEventQueue.filter(e => !e.event.canceled);
					for (let entry of currentEventQueue) {
						broadcastMatchEvent(gameState, matchDispatcher, entry.event);
					}
					// update available action
					broadcastUpdateAvailabeActions(gameState, matchDispatcher);
				}
				else if (gameState.resolvedEventQueue.length > 0) {
					
					// trigger response
					Match.makePlayersSelectResponseTriggerAbility(gameState, gameState.resolvedEventQueue.map(e => e.event), "after");
					gameState.resolvedEventQueue.splice(0);
				}
				
			}

			break;

		case "ended":
			//logger.debug(JSON.stringify(gameState.endResult))
			broadcastMatchEnd(gameState, matchDispatcher);
			// grant play rewards
			for (let playerId of players) {
				let coinReward: number = 0;
				if (Match.isWinner(gameState, playerId)) {
					coinReward = Utility.randomIntRange(120, 181);
				} else if (Match.getEndReason(gameState) != EndResultStringKeys.DISCONNECTED) {
					coinReward = Utility.randomIntRange(40, 61);
				}
				gameStorageAccess.givePlayerCoin(playerId, coinReward);
			}
			//players.forEach(id => sendEventGameEnded(gameState, matchDispatcher, id));
			return null;
	}

	return {
		state: {
			gameState,
			presences,
			eventHandler
		}
	};
};

const matchSignal: nkruntime.MatchSignalFunction = function(ctx, logger, nk, dispatcher, tick, state, data) {
	let gameState: GameState = state.gameState;
	let presences: PlayerPresences = state.presences;
	let eventHandler: GameEventHandler = state.eventHandler;
	logger.info(`Match signal received: ${data}`);
	if (data === "dump_state") {
		data = JSON.stringify({ gameState: gameState })
	}
	return {
		state: {
			gameState,
			presences,
			eventHandler
		},
		data
	};
}

const matchTerminate: nkruntime.MatchTerminateFunction = function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
	let gameState: GameState = state.gameState;
	let presences: PlayerPresences = state.presences;
	let eventHandler: GameEventHandler = state.eventHandler;
	//let matchDispatcher = createNakamaMatchDispatcher(dispatcher, presences);
	let players = Match.getActivePlayers(gameState);
	// notify match terminate
	//broadcastMatchEnd(gameState, matchDispatcher);
	// remove all players from game state
	players.forEach(id => delete(gameState.players[id]));
	presences = {}
	logger.info(`Match terminated`);
	return {
		state: {
			gameState,
			presences,
			eventHandler
		}
	};
};

export const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function(ctx, logger, nk, matches) {
	const matchId = nk.matchCreate("lobby", {});
	return matchId;
}

export const matchHandler: nkruntime.MatchHandler = {
	matchInit,
	matchJoin,
	matchJoinAttempt,
	matchLeave,
	matchLoop,
	matchSignal,
	matchTerminate
};