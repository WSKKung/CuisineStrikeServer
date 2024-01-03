type PlayerPresences = {[playerId: string]: nkruntime.Presence | undefined}

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
		tickRate: MATCH_TICK_RATE,
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
	let players = Match.getActivePlayers(gameState);
	
	switch (gameState.status) {
		case "init":
			// wait until all players join the game
			if (players.length >= 2) {
				// initialize deck
				players.forEach(id => {
					// main deck
					let deckCards: Array<Card> = []
					for (let i = 0; i < 5; i++) {
						let cardId = idGen.uuid();
						let cardCode = 1;
						let newCardBaseProperties = Card.loadCardBaseProperties(cardCode, nk);
						let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties);
						deckCards.push(newCard);
					}
					for (let i = 0; i < 5; i++) {
						let cardId = idGen.uuid();
						let cardCode = 2;
						let newCardBaseProperties = Card.loadCardBaseProperties(cardCode, nk);
						let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties);
						deckCards.push(newCard);
					}
					deckCards.forEach(card => Match.addCard(gameState, card));
					Match.moveCard(gameState, deckCards, CardLocation.MAIN_DECK, id, null, "shuffle");

					// recipe deck
					let recipeDeckCards: Array<Card> = []
					for (let i = 0; i < 5; i++) {
						let cardId = idGen.uuid();
						let cardCode = 5;
						let newCardBaseProperties = Card.loadCardBaseProperties(cardCode, nk);
						let newCard = Card.create(cardId, cardCode, id, newCardBaseProperties);
						recipeDeckCards.push(newCard);
					}
					recipeDeckCards.forEach(card => Match.addCard(gameState, card));
					Match.moveCard(gameState, recipeDeckCards, CardLocation.RECIPE_DECK, id);

					// starting hand
					let initialHandSize = 4;
					let cardsToBeHand = Match.getTopCards(gameState, initialHandSize, CardLocation.MAIN_DECK, id);
					Match.moveCard(gameState, cardsToBeHand, CardLocation.HAND, id);


				});

				// initialize gamestate
				gameState.turnCount = 1;
				gameState.turnPlayer = players[0];
				gameState.status = "running";
				broadcastMatchState(gameState, matchDispatcher);	

				/** 
				let serializableState: {[playerId: string]: any} = {}
				Match.getActivePlayers(gameState).forEach(id => {
					serializableState[id] = {
						hand: Match.getCards(gameState, CardLocation.HAND, id).map(c => c.id),
						mainDeck: Match.getCards(gameState, CardLocation.MAIN_DECK, id).map(c => c.id),
						recipeDeck: Match.getCards(gameState, CardLocation.RECIPE_DECK, id).map(c => c.id),
						trash: Match.getCards(gameState, CardLocation.TRASH, id).map(c => c.id),
						serveZone: Match.getCards(gameState, CardLocation.SERVE_ZONE, id).map(c => c.id),
						standbyZone: Match.getCards(gameState, CardLocation.STANDBY_ZONE, id).map(c => c.id)
					}
				})
				logger.info("match state field: " + JSON.stringify(serializableState))
				*/
			}
			break;

		case "running":	


			let previousLastAction = gameState.lastAction;

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
				receivePlayerMessage(gameState, senderId, opCode, dataStr, matchDispatcher, logger);
			});

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
				broadcastMatchActionEvent(gameState, matchDispatcher, currentLastAction);
				logger.info("detected last action update")
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
	let matchDispatcher = createNakamaMatchDispatcher(dispatcher, presences);
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

const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function(ctx, logger, nk, matches) {
	const matchId = nk.matchCreate("lobby", {});
	return matchId;
}

const matchHandler: nkruntime.MatchHandler = {
	matchInit,
	matchJoin,
	matchJoinAttempt,
	matchLeave,
	matchLoop,
	matchSignal,
	matchTerminate
};