import { Card } from "./card";
import { receivePlayerMessage } from "./communications/receiver";
import { broadcastMatchState, broadcastMatchEvent, broadcastMatchEnd } from "./communications/sender";
import { GameEventListener, GameEventType, createGameEventListener, GameEvent } from "./event_queue";
import { CardLocation } from "./card";
import { GameState, Match, getPlayerId } from "./match";
import { createNakamaIDGenerator, createNakamaMatchDispatcher, createNakamaGameStorageAccess } from "./wrapper";
import { GameConfiguration } from "./constants";

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
					presences
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
					presences
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
			presences
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
	gameState.log = logger;
	gameState.nk = nk;
	let idGen = createNakamaIDGenerator(nk);
	let matchDispatcher = createNakamaMatchDispatcher(dispatcher, presences);
	let gameStorageAccess = createNakamaGameStorageAccess(nk);
	let players = Match.getActivePlayers(gameState);
	
	switch (gameState.status) {
		case "init":
			// wait until all players join the game
			if (players.length >= 2) {
				// initialize deck
				players.forEach(id => {
					// main deck
					// TODO: Use player's selected deck from database instead
					try {
						let deckCards: Array<Card> = [];
						for (let i = 0; i < 4; i++) {
							let cardId = idGen.uuid();
							let cardCode = 1;
							let newCardBaseProperties = gameStorageAccess.readCardProperty(cardCode);
							let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties);
							deckCards.push(newCard);
						}
						for (let i = 0; i < 6; i++) {
							let cardId = idGen.uuid();
							let cardCode = 3;
							let newCardBaseProperties = gameStorageAccess.readCardProperty(cardCode);
							let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties);
							deckCards.push(newCard);
						}
						deckCards.forEach(card => Match.addCard(gameState, card));
						Match.moveCard(gameState, deckCards, CardLocation.MAIN_DECK, id, null, "shuffle");

					} catch (error: any) {
						logger.error(`Main deck initialization for player %s failed: %s`, id, error.message);
					}

					// recipe deck
					// TODO: Use player's selected deck from database instead
					try {
						let recipeDeckCards: Array<Card> = [];
						for (let i = 0; i < 3; i++) {
							let cardId = idGen.uuid();
							let cardCode = 4;
							let newCardBaseProperties = gameStorageAccess.readCardProperty(cardCode);
							let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties!);
							recipeDeckCards.push(newCard);
						}
						for (let i = 0; i < 3; i++) {
							let cardId = idGen.uuid();
							let cardCode = 5;
							let newCardBaseProperties = gameStorageAccess.readCardProperty(cardCode);
							let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties!);
							recipeDeckCards.push(newCard);
						}
						recipeDeckCards.forEach(card => Match.addCard(gameState, card));
						Match.moveCard(gameState, recipeDeckCards, CardLocation.RECIPE_DECK, id);
					} catch (error: any) {
						logger.error(`Recipe deck initialization for player %s failed: %s`, id, error.message);
					}
					// starting hand
					let initialHandSize = 4;
					let cardsToBeHand = Match.getTopCards(gameState, initialHandSize, CardLocation.MAIN_DECK, id);
					Match.moveCard(gameState, cardsToBeHand, CardLocation.HAND, id);


				});

				// initialize gamestate
				gameState.turnCount = 0;
				gameState.turnPlayer = players[0];
				gameState.status = "running";
				broadcastMatchState(gameState, matchDispatcher);

				// initial draw
				Match.fillHand(gameState, Match.getTurnPlayer(gameState), GameConfiguration.drawSizePerTurns, 1);
			}
			break;

		case "running":	

			let previousLastAction = gameState.lastAction;

			// TODO: Make listener a map from event type to listeners instead and put it somewhere (on either gameState or matchState)
			let eventListeners: Array<GameEventListener<GameEventType>> = [
				createGameEventListener("change_turn", (event, context) => {
					let turnPlayer = Match.getTurnPlayer(context.gameState);
					Match.fillHand(context.gameState, turnPlayer, GameConfiguration.drawSizePerTurns, 1);
				})
			]

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

			// TODO: Store actions as queue instead to support card ability efficifently
			// check if an action happened
			let currentLastAction = gameState.lastAction;
			// if current state now has last action
			if (currentLastAction) {
				// if last action before is present and has same id as current last action, thus no update
				if (previousLastAction && currentLastAction.id === previousLastAction.id) {
					break;
				}
				
				//logger.info("prev last action: %s", previousLastAction ? JSON.stringify(previousLastAction) : "none");
				//logger.info("cur last action: %s", currentLastAction ? JSON.stringify(currentLastAction) : "none");
				// broadcast event from last action happened to every player
				//broadcastMatchActionEvent(gameState, matchDispatcher, currentLastAction);
				logger.info("detected last action update")
			}

			// copy event queue from game state
			let currentEventQueue = [ ...gameState.eventQueue ];
			// clear current event queue for upcoming events
			gameState.eventQueue = []
			while (currentEventQueue.length > 0) {
				let event: GameEvent = currentEventQueue.shift()!;
				// announce event
				broadcastMatchEvent(gameState, matchDispatcher, event);
				// handling current event
				// new event caused here will be processed in the next tick
				for (let listener of eventListeners) {
					if (event.type === listener.type) {
						listener.on(event, { gameState: gameState });
					}
				}
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
			presences
		}
	};
};

const matchSignal: nkruntime.MatchSignalFunction = function(ctx, logger, nk, dispatcher, tick, state, data) {
	let gameState: GameState = state.gameState;
	let presences: PlayerPresences = state.presences;
	logger.info(`Match signal received: ${data}`);
	return {
		state: {
			gameState,
			presences
		},
		data
	};
}

const matchTerminate: nkruntime.MatchTerminateFunction = function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
	let gameState: GameState = state.gameState;
	let presences: PlayerPresences = state.presences;
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
			presences
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