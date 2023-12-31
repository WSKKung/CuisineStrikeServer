// Match created
const matchInit: nkruntime.MatchInitFunction = function(ctx, logger, nk, params) {
	let state: GameState = Match.createState();
	let label = "";
	logger.info(`Match created`)
	return {
		state,
		tickRate: MATCH_TICK_RATE,
		label
	};
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
	let gameState = state as GameState
	let joinedPlayerId = getPlayerId(presence);
	// match is not started yet 
	if (gameState.status === "init") {
		// reject already joined player
		if (Match.hasPlayer(gameState, joinedPlayerId)) {
			return {
				state: gameState,
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
				state: gameState,
				accept: false,
				rejectMessage: "Match already started"
			};
		}
	}
	
	logger.info(`Player ${joinedPlayerId} attempted to join a match`)
	return {
		state: gameState,
		accept: true
	};
};

const matchJoin: nkruntime.MatchJoinFunction = function(ctx, logger, nk, dispatcher, tick, state, presences) {
	let gameState = state as GameState
	logger.info(`Player ${presences.map(getPlayerId).join(", ")} joined a match`);
	presences.forEach(p => {
		let pId = getPlayerId(p);
		Match.addPlayer(gameState, pId);
		Match.setPresence(gameState, pId, p);
	});
	return {
		state: gameState
	};
};

const matchLeave: nkruntime.MatchLeaveFunction = function(ctx, logger, nk, dispatcher, tick, state, presences) {
	let gameState = state as GameState
	logger.info(`Player ${presences.map(getPlayerId).join(", ")} left a match`);
	presences.forEach(p => {
		let pId = getPlayerId(p);
		Match.removePresence(gameState, pId);
	});
	return {
		state: gameState
	};
};

const matchLoop: nkruntime.MatchLoopFunction = function(ctx, logger, nk, dispatcher, tick, state, messages) {
	let gameState = state as GameState;
	gameState.log = logger
	let matchDispatcher = createNakamaMatchDispatcher(dispatcher, gameState);
	let players = Match.getActivePlayers(gameState);
	
	switch (gameState.status) {
		case "init":
			// wait until all players join the game
			if (players.length >= 2) {
				// initialize deck
				players.forEach(id => {
					let deckCards: Array<Card> = []
					for (let i = 0; i < 5; i++) {
						let cardId = nk.uuidv4();
						let cardCode = 1;
						let newCard = Card.create(cardId, cardCode, id, nk);
						deckCards.push(newCard);
					}
					deckCards.forEach(card => Match.addCard(gameState, card));
					Match.moveCard(gameState, deckCards, CardLocation.MAIN_DECK, id, null, "shuffle");
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
			if (currentLastAction && currentLastAction !== previousLastAction) {
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
		state: gameState
	};
};

const matchSignal: nkruntime.MatchSignalFunction = function(ctx, logger, nk, dispatcher, tick, state, data) {
	let gameState = state as GameState
	logger.info(`Match signal received: ${data}`);
	return {
		state: gameState,
		data
	};
}

const matchTerminate: nkruntime.MatchTerminateFunction = function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
	let gameState = state as GameState
	let matchDispatcher = createNakamaMatchDispatcher(dispatcher, gameState);
	let players = Match.getActivePlayers(gameState);
	// notify match terminate
	//broadcastMatchEnd(gameState, matchDispatcher);
	// remove all players from game state
	players.forEach(id => delete(gameState.players[id]));
	logger.info(`Match terminated`);
	return {
		state: gameState
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