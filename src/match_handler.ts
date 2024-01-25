import { Card } from "./card";
import { receivePlayerMessage } from "./communications/receiver";
import { broadcastMatchState, broadcastMatchEvent, broadcastMatchEnd } from "./communications/sender";
import { GameEventListener, GameEventType, createGameEventListener, GameEvent } from "./event_queue";
import { CardLocation } from "./card";
import { GameState, Match, getPlayerId } from "./match";
import { createNakamaIDGenerator, createNakamaMatchDispatcher, createNakamaGameStorageAccess } from "./wrapper";
import { GameConfiguration } from "./constants";
import { Utility } from "./utility";
import { GameEventHandler, createEventHandler, setupBaseMechanicsEventHandler } from "./event_handler";

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
	let gameStorageAccess = createNakamaGameStorageAccess(nk, logger);
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
					try {
						for (let cardCode of [1, 2, 3, 6]) {
							for (let i = 0; i < 10; i++) {
								let cardId = idGen.uuid();
								let newCardBaseProperties = gameStorageAccess.readCardProperty(cardCode);
								let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties);
								deckCards.push(newCard);
							}
						}

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
						for (let cardCode of [4, 5, 7]) {
							for (let i = 0; i < 5; i++) {
								let cardId = idGen.uuid();
								let newCardBaseProperties = gameStorageAccess.readCardProperty(cardCode);
								let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties!);
								recipeDeckCards.push(newCard);
							}							
						}
						recipeDeckCards.forEach(card => Match.addCard(gameState, card));
					} catch (error: any) {
						logger.error(`Recipe deck initialization for player %s failed: %s`, id, error.message);
					}

					Match.moveCard(gameState, handCards, CardLocation.HAND, id);
					Match.moveCard(gameState, deckCards, CardLocation.MAIN_DECK, id);
					Match.moveCard(gameState, recipeDeckCards, CardLocation.RECIPE_DECK, id);

					let addedCards = handCards.concat(deckCards).concat(recipeDeckCards);
					addedCards.forEach(card => Match.addCard(gameState, card));
					Match.updateCards(gameState, handCards.concat(deckCards).concat(recipeDeckCards), "init", "");
				});

				if (!eventHandler) {
					eventHandler = createEventHandler();
				}
				eventHandler = setupBaseMechanicsEventHandler(eventHandler);

				// initialize gamestate
				gameState.status = "running";
				gameState.turnPlayer = Match.getRandomPlayer(gameState)
				gameState.turnCount = 1
				broadcastMatchState(gameState, matchDispatcher);

				Match.beginTurn(gameState)
			}
			break;

		case "running":	

			// end game if no enough player to play the game
			if (players.length < 2) {
				// make remaining player wins the game
				gameState.status = "ended";
				gameState.endResult = {
					winners: players,
					reason: "DISCONNECTED"
				}
				break;
			}

			// read player messages
			messages.forEach(msg => {
				let senderId = getPlayerId(msg.sender);
				let opCode = msg.opCode;
				let dataStr = nk.binaryToString(msg.data);
				receivePlayerMessage(gameState, senderId, opCode, dataStr, matchDispatcher, logger, gameStorageAccess);
			});

			// copy event queue from game state
			let currentEventQueue = [ ...gameState.eventQueue ];
			// clear current event queue for upcoming events
			gameState.eventQueue.splice(0);
			//logger.debug("t %d: processing match events checking", tick);
			if (currentEventQueue.length > 0) {
				logger.debug("t %d: processing match events begins", tick);
				while (currentEventQueue.length > 0) {
					let event: GameEvent = currentEventQueue.shift()!;
					//gameState.eventQueue = gameState.eventQueue.filter(eq => eq.id !== event.id);
					//logger.debug("detected event: %s", JSON.stringify(event));
					// announce event
					broadcastMatchEvent(gameState, matchDispatcher, event);
					// handling current event
					// new event caused here will be processed in the next tick
					logger.debug("t %d: processing match event with type %s and id %s", tick, event.type, event.id);
					eventHandler.handle(event, gameState);
				}
				logger.debug("t %d: processing match events ends", tick);
			}

			let alivePlayer = players.filter(id => Match.getHP(gameState, id) > 0);
			// has at least one player who is dead
			if (alivePlayer.length < players.length) {
				gameState.status = "ended";
				gameState.endResult = {
					winners: alivePlayer,
					reason: "DEAD"
				};
			}

			break;

		case "ended":
			logger.debug(JSON.stringify(gameState.endResult))
			broadcastMatchEnd(gameState, matchDispatcher);
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