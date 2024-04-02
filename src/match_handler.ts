import { Card, CardLocation, CardType } from "./model/cards";
import { receivePlayerMessage } from "./communications/receiver";
import { broadcastMatchState, broadcastMatchEvent, broadcastMatchEnd, broadcastUpdateAvailabeActions, sendRequestChoiceAction, sendResponseChoiceAction, broadcastGameStart, broadcastGameEnd, broadcastMatchSyncReady, broadcastMatchSyncTimer, sendCurrentMatchState } from "./communications/sender";
import { GameEventListener, GameEventType, createGameEventListener } from "./event_queue";
import { EventReason, GameEvent, GameEventContext } from "./model/events";
import { EventQueue, GameState, Match, getPlayerId } from "./match";
import { createNakamaIDGenerator, createNakamaMatchDispatcher, createSequentialIDGenerator, NakamaAdapter } from "./wrapper";
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
	let matchDispatcher = NakamaAdapter.matchDispatcher({ nk, logger, dispatcher, presences: currentPresences });
	//logger.info(`Player ${presences.map(getPlayerId).join(", ")} joined a match`);
	if (gameState.status === "init") {
		presences.forEach(presence => {
			let playerId = getPlayerId(presence);
			Match.addPlayer(gameState, playerId);
			Match.setPlayerOnline(gameState, playerId, true);
			currentPresences[playerId] = presence;
			//Match.setPresence(gameState, pId, p);
		});
	} else if (gameState.status === "paused" && gameState.pauseStatus?.reason === "disconnected") {
		presences.forEach(presence => {
			let playerId = getPlayerId(presence);
			Match.setPlayerOnline(gameState, playerId, true);
			currentPresences[playerId] = presence;
			sendCurrentMatchState(gameState, matchDispatcher, playerId);
		});

		if (Match.getActivePlayers(gameState).length >= 2) {
			Match.unpause(gameState);
		}
	}


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

	//logger.info(`Player ${presences.map(getPlayerId).join(", ")} left a match`);

	presences.forEach(presence => {
		let playerId = getPlayerId(presence);
		Match.setPlayerOnline(gameState, playerId, false);
		currentPresences[playerId] = undefined;

		// save match id into metadata in case player want to rejoin
		let account = nk.accountGetId(playerId);
		let meta = account.user.metadata;
		meta.ongoing_match_id = ctx.matchId;
		nk.accountUpdateId(playerId, null, null, null, null, null, null, meta);
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
	let deltaTime: number = 1000 / GameConfiguration.tickRate;

	let gameState: GameState = state.gameState;
	let presences: PlayerPresences = state.presences;
	let eventHandler: GameEventHandler = state.eventHandler;
	gameState.log = logger;
	gameState.nk = nk;
	let idGen = createSequentialIDGenerator();
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

				broadcastGameStart(gameState, matchDispatcher);

				(async() => {
					
					broadcastMatchState(gameState, matchDispatcher);
					
					let initContext: GameEventContext = { player: null, reason: EventReason.INIT };
					// initialize deck
					for (let id of players) {
						// main deck
						let deckCards: Array<Card> = [];
						let handCards: Array<Card> = [];
						let deck: Deck = gameStorageAccess.readPlayerActiveDeck(id);
						try {
							deckCards = deck.main.map(entry => {
								let cardId = idGen.uuid();
								let cardProps = gameStorageAccess.readCardProperty(entry.code);
								return Card.create(cardId, entry.code, id, cardProps)
							});

							Utility.shuffle(deckCards);

							// select random cards from deck to be in the initial hand
							handCards = deckCards.splice(0, GameConfiguration.initialHandSize);

						} catch (error: any) {
							logger.error(`Main deck initialization for player %s failed: %s`, id, error.message);
						}

						// recipe deck
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

						// register recipe
						let cardCode = Card.getCode(card);
						if (gameState.recipe[cardCode] === undefined) {
							if (Card.hasType(card, CardType.DISH)) {
								gameState.recipe[cardCode] = gameStorageAccess.readDishCardRecipe(cardCode);
							} else {
								gameState.recipe[cardCode] = null;
							}
						}

						// register effect
						let effects = CardEffectProvider.getEffects(Card.getCode(card));
						for (let effect of effects) {
							Match.registerEffect(gameState, card, effect);
						}
					}

					await Match.beginTurn(gameState, initContext);
					
				})();

				// Match.pause(gameState, {
				// 	reason: "sync_ready",
				// 	remainingPlayers: players.concat()
				// });
				// broadcastMatchSyncReady(gameState, matchDispatcher);
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

			if (gameState.pauseStatus !== null) {
				switch (gameState.pauseStatus.reason) {
					case "disconnected":
						gameState.pauseStatus.timeout -= deltaTime;
						if (gameState.pauseStatus.timeout <= 0) {
							Match.end(gameState, {
								winners: players,
								reason: EndResultStringKeys.DISCONNECTED
							});
						}
						break;
				}
			} else {
				gameState.status = "running";
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
				Match.pause(gameState, {
					reason: "disconnected",
					timeout: GameConfiguration.disconnectTimeout
				});
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
			let currentEventQueue: EventQueue = [ ...gameState.eventQueue ];
			// clear current event queue for upcoming events
			gameState.eventQueue.splice(0);

			if (currentEventQueue.length > 0) {
				// pre-resolution trigger response
				if (Match.makePlayersSelectResponseTriggerAbility(gameState, currentEventQueue.map(e => e.event), "before")) {
					// hold every event to process later if there is some ability player can select
					gameState.onHeldEventQueue.push(...currentEventQueue);
					break;
				}

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

				// pause timer while resolving action (if any)
				if (resolvedTickEvent.length > 0) {
					Match.pauseAllPlayersTimer(gameState);
				}
			}
			else {
				// push held event to resolve next tick
				if (gameState.onHeldEventQueue.length > 0) {
					gameState.eventQueue.push(...gameState.onHeldEventQueue);
					gameState.onHeldEventQueue.splice(0);
				}

				// do post-resolution event processing
				else if (gameState.resolvedEventQueue.length > 0) {
					// update available action
					broadcastUpdateAvailabeActions(gameState, matchDispatcher);
					// pause if no trigger action until every player are ready
					Match.pause(gameState, {
						reason: "sync_ready",
						remainingPlayers: players.concat()
					});
					broadcastMatchSyncReady(gameState, matchDispatcher);
					// also post-resolution trigger response
					
					Match.makePlayersSelectResponseTriggerAbility(gameState, gameState.resolvedEventQueue.map(e => e.event), "after")

					gameState.resolvedEventQueue.splice(0)
				}
				// no event to process
				else {
					Match.resumePlayerTimer(gameState, Match.getTurnPlayer(gameState));
				}
			}


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

	if (gameState.status == "paused" || gameState.status == "running") {
		for (let player of players) {
			Match.countdownPlayerTimer(gameState, player, deltaTime);
		}
		broadcastMatchSyncTimer(gameState, matchDispatcher);
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