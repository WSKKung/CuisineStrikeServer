interface GameState extends nkruntime.MatchState {
	/**@deprecated */
	presences: {[id: string]: nkruntime.Presence},
	players: {[id: string]: PlayerData},
	status: "init" | "running" | "ended",
	turnPlayer: string,
	turnCount: number,
	winner?: string
}

interface PlayerData {
	id: string,
	presence?: nkruntime.Presence,
	hp: number,
	prevHp: number,
	hand: CardZone,
	mainDeck: CardZone,
	recipeDeck: CardZone,
	trash: CardZone,
	serveZones: Array<CardZone>,
	standbyZone: Array<CardZone>,
}

function getPlayerId(presence: nkruntime.Presence): string {
	return presence.sessionId;
}

namespace Match {

	function createPlayerData(id: string): PlayerData {
		let hand = Field.createZone(CardLocation.HAND);
		let mainDeck = Field.createZone(CardLocation.MAIN_DECK);
		let recipeDeck = Field.createZone(CardLocation.RECIPE_DECK);
		let trash = Field.createZone(CardLocation.TRASH);
		let serveZones: Array<CardZone> = [];
		let standbyZone: Array<CardZone> = [];
		for (let col = 0; col < MATCH_BOARD_COLUMNS; col++) {
			serveZones.push(Field.createZone(CardLocation.SERVE_ZONE, col));
			standbyZone.push(Field.createZone(CardLocation.STANDBY_ZONE, col));
		}
		return {
			id,
			hp: PLAYER_INITIAL_HP,
			prevHp: PLAYER_INITIAL_HP,
			hand, mainDeck, recipeDeck, trash, serveZones, standbyZone
		};
	}

	export function createState(): GameState {
		return {
			presences: {},
			playerData: {},
			players: {},
			status: "init",
			turnPlayer: "",
			turnCount: 0
		};
	}

	export function hasPlayer(state: GameState, id: string): boolean {
		return !!state.players[id];
	}
	
	export function getPlayer(state: GameState, id: string): PlayerData {
		return state.players[id];
	}
	
	export function addPlayer(state: GameState, id: string): void {
		let newPlayerData: PlayerData = createPlayerData(id);
		state.players[id] = newPlayerData;
	}
	
	export function getPlayers(state: GameState): Array<string> {
		return Object.keys(state.players);
	}
	
	export function getActivePlayers(state: GameState): Array<string> {
		return getPlayers(state).filter(id => hasPresence(state, id));
	}
	
	export function isPlayerTurn(state: GameState, id: string): boolean {
		return state.turnPlayer === id;
	}
	
	// #region Players

	export function getOpponent(state: GameState, id: string): string {
		let playerIds = Object.keys(state.players);
		let oppId = id === playerIds[0] ? playerIds[1] : playerIds[0];
		return oppId;
	}

	export function getHP(state: GameState, playerId: string): number {
		return state.players[playerId].hp;
	}

	export function getPreviousHP(state: GameState, playerId: string): number {
		return state.players[playerId].prevHp;
	}

	export function setHP(state: GameState, playerId: string, hp: number): void {
		if (hp < 0) hp = 0;
		state.players[playerId].prevHp = state.players[playerId].hp;
		state.players[playerId].hp = hp;
	}

	export function setPresence(state: GameState, playerId: string, presence: nkruntime.Presence): void {
		state.players[playerId].presence = presence;
   	}

	export function removePresence(state: GameState, playerId: string): void {
		delete state.players[playerId].presence;
   	}

	export function hasPresence(state: GameState, playerId: string): boolean {
		return !!state.players[playerId].presence;
	}

	export function getPresence(state: GameState, playerId: string): nkruntime.Presence {
		let presence = state.players[playerId].presence;
		if (!presence) {
			throw new Error("Player has no presence!");
		}
 		return presence;
	}
	// #endregion
	
	function findZone(state: GameState, location: CardLocation, ownerId: string, column: number): CardZone {
		var playerData = getPlayer(state, ownerId);
		switch (location) {
			case CardLocation.HAND:
				return playerData.hand;
			case CardLocation.MAIN_DECK:
				return playerData.mainDeck;
			case CardLocation.RECIPE_DECK:
				return playerData.recipeDeck;
			case CardLocation.TRASH:
				return playerData.trash;
			case CardLocation.SERVE_ZONE:
				return playerData.serveZones[column];
			case CardLocation.STANDBY_ZONE:
				return playerData.standbyZone[column];
			default:
				throw new Error("Unknown zone location");
		}
	}

	export function moveCard(state: GameState, cards: Card | Array<Card>, targetLocation: CardLocation, targetPlayerId: string, column?: number, insertLocation?: "top" | "bottom" | "shuffle") {
		// default parameters
		column = column || 0;
		insertLocation = insertLocation || "top";
		if (!(cards instanceof Array)) {
			cards = [ cards ];
		}

		let targetZone = findZone(state, targetLocation, targetPlayerId, column);
		switch (insertLocation) {
			case "top":
				targetZone.cards.push(...cards);
				break;
			case "bottom":
				targetZone.cards = cards.concat(targetZone.cards);
				break;
			case "shuffle":
				targetZone.cards.push(...cards);
				break;
		}
		cards.forEach(card => card.zone = targetZone);
	}
	export function getCards(state: GameState, location: CardLocation, ownerId: string, column?: number): Array<Card> {
		// default parameters
		column = column || 0;

		let targetZone = findZone(state, location, ownerId, column);
		return [ ...targetZone.cards ];
		
	}
	export function findCards(state: GameState, filterCondition: (card: Card) => boolean, location: CardLocation, ownerId: string, column?: number): Array<Card> {
		let cards = getCards(state, location, ownerId, column);
		return cards.filter(filterCondition);
	}

	export function getTopCards(state: GameState, count: number, location: CardLocation, ownerId: string, column?: number): Array<Card> {
		let cards = getCards(state, location, ownerId, column);
		count = Math.min(count, cards.length);
		return cards.slice(-(count + 1), -1);
		
	}

	export function gotoNextTurn(state: GameState): void {
		state.turnCount += 1;
		state.turnPlayer = getOpponent(state, state.turnPlayer);
		
	}

	export function isWinner(state: GameState, playerId: string): boolean {
		if (state.status !== "ended") return false;
		return (state.winner && state.winner === playerId) || false;
	}
}
