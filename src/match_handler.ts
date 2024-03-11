import { Card, CardLocation, CardType } from "./model/cards";
import { receivePlayerMessage } from "./communications/receiver";
import { broadcastMatchState, broadcastMatchEvent, broadcastMatchEnd, broadcastUpdateAvailabeActions, sendRequestChoiceAction, sendResponseChoiceAction, broadcastGameStart, broadcastGameEnd, broadcastMatchSyncReady, broadcastMatchSyncTimer } from "./communications/sender";
import { GameEventListener, GameEventType, createGameEventListener } from "./event_queue";
import { EventReason, GameEvent, GameEventContext } from "./model/events";
import { EventQueue, GameState, Match, getPlayerId } from "./match";
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
	let matchDispatcher = NakamaAdapter.matchDispatcher({ nk, logger, dispatcher, presences: currentPresences })
	logger.info(`Player ${presences.map(getPlayerId).join(", ")} left a match`);
	presences.forEach(presence => {
		let playerId = getPlayerId(presence);
		Match.setPlayerOnline(gameState, playerId, false);
		currentPresences[playerId] = undefined;
		//Match.removePresence(gameState, pId);
	});

	// remove match instantly if player leave while a room is initializing
	if (gameState.status == "init" && Match.getActivePlayers(gameState).length < 2) {
		broadcastMatchEnd(gameState, matchDispatcher)
		return null;
	}

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
					// initialize gamestate
					gameState.status = "running";
					gameState.turnPlayer = Match.getRandomPlayer(gameState)
					gameState.turnCount = 1;
				
					// register effect scripts
					registerCardEffectScripts();

					(async() => {
						
						let initContext: GameEventContext = { player: null, reason: EventReason.INIT };
						// initialize deck
						for (let id of players) {
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

							let addedCards = handCards.concat(deckCards).concat(recipeDeckCards);
							addedCards.forEach(card => Match.addCard(gameState, card));
							Match.moveCardToZone(gameState, initContext, handCards, gameState.players[id]!.hand, "top");
							Match.moveCardToZone(gameState, initContext, deckCards, gameState.players[id]!.mainDeck, "top");
							Match.moveCardToZone(gameState, initContext, recipeDeckCards, gameState.players[id]!.recipeDeck, "top");
						}
						
						for (let cardId in gameState.cards) {
							let card: Card = gameState.cards[cardId];
							let effects = CardEffectProvider.getEffects(Card.getCode(card));
							for (let effect of effects) {
								Match.registerEffect(gameState, card, effect);
							}
						}

						broadcastMatchState(gameState, matchDispatcher);
						//broadcastUpdateAvailabeActions(gameState, matchDispatcher);

						await Match.beginTurn(gameState, initContext);
						
						broadcastGameStart(gameState, matchDispatcher);

					})();

				Match.pause(gameState, {
					reason: "sync_ready",
					remainingPlayers: players.concat()
				});
				broadcastMatchSyncReady(gameState, matchDispatcher);
			}
			
			break;

		case "paused":

			// read player messages
			messages.forEach(msg => {
				let senderId = getPlayerId(msg.sender);
				let opCode = msg.opCode;
				let dataStr = nk.binaryToString(msg.data);
				receivePlayerMessage(gameState, senderId, opCode, dataStr, matchDispatcher, logger, gameStorageAccess);
			});

			if (gameState.pauseStatus === null) {
				gameState.status = "running"
			}

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
			messages.forEach(msg => {
				let senderId = getPlayerId(msg.sender);
				let opCode = msg.opCode;
				let dataStr = nk.binaryToString(msg.data);
				receivePlayerMessage(gameState, senderId, opCode, dataStr, matchDispatcher, logger, gameStorageAccess);
			});
			
			// copy event queue from game state
			// events on held from previos paused will be processed later than the events happening after pause (from response, etc.)
			let currentEventQueue: EventQueue = [ ...gameState.eventQueue, ...gameState.onHeldEventQueue ];
			// clear current event queue for upcoming events
			gameState.eventQueue.splice(0);
			gameState.onHeldEventQueue.splice(0);

			if (currentEventQueue.length > 0) {

				let resolvedTickEvent: EventQueue = []

				// resolve event
				for (let i = 0; i < currentEventQueue.length; i++) {
					let entry = currentEventQueue[i];
					// store remaining event to process later if the game is paused (on resolution by some previous event) until the game unpaused
					if (Match.isPaused(gameState)) {
						gameState.onHeldEventQueue.push(entry);
						continue;
					}
					// skip canceled event
					if (entry.event.canceled) {
						entry.reject();
						continue;
					}
					// resolve event
					entry.resolve();
					resolvedTickEvent.push(entry);
				}
				
				for (let entry of resolvedTickEvent) {
					// broadcast resolved event
					broadcastMatchEvent(gameState, matchDispatcher, entry.event);
					// push into another event queue to process post-resolution trigger response
					gameState.resolvedEventQueue.push(entry);
				}


			}
			// do post-resolution event processing
			else if (gameState.resolvedEventQueue.length > 0) {
				// update available action
				broadcastUpdateAvailabeActions(gameState, matchDispatcher);
				// trigger response
				Match.makePlayersSelectResponseTriggerAbility(gameState, gameState.resolvedEventQueue.map(e => e.event), "after");
				gameState.resolvedEventQueue.splice(0);
				// pause until every player are ready
				Match.pause(gameState, {
					reason: "sync_ready",
					remainingPlayers: players.concat()
				});
				broadcastMatchSyncReady(gameState, matchDispatcher);
			}

			broadcastMatchSyncTimer(gameState, matchDispatcher);

			break;

		case "ended":
			//logger.debug(JSON.stringify(gameState.endResult))
			broadcastGameEnd(gameState, matchDispatcher);
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

			broadcastMatchEnd(gameState, matchDispatcher);
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