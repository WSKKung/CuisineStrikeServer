interface GameResult {
	winners: Array<string>,
	reason: string
}

interface GameState extends nkruntime.MatchState {
	//TODO: Decoupling GameState from Nakama state altogether
	log?: nkruntime.Logger,
	nk?: nkruntime.Nakama,
	players: {[id: string]: PlayerData | undefined},
	cards: {[id: CardID]: Card},
	status: "init" | "running" | "ended",
	turnPlayer: string,
	turnCount: number,
	endResult: GameResult | null,
	lastAction: ActionResult | null
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
	online: boolean
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
			online: false,
			hand, mainDeck, recipeDeck, trash, serveZones, standbyZone
		};
	}

	
	export function createState(): GameState {
		return {
			playerData: {},
			players: {},
			cards: {},
			status: "init",
			turnPlayer: "",
			turnCount: 0,
			endResult: null,
			lastAction: null
		};
	}

	export function newUUID(state: GameState): string {
		if (!state.nk) {
			return "00000000-0000-0000-0000-000000000000";
		}
		return state.nk.uuidv4();
	}

	export function hasPlayer(state: GameState, id: string): boolean {
		return !!state.players[id];
	}
	
	export function getPlayer(state: GameState, id: string): PlayerData {
		return state.players[id]!;
	}
	
	export function addPlayer(state: GameState, id: string): void {
		let newPlayerData: PlayerData = createPlayerData(id);
		state.players[id] = newPlayerData;
	}

	export function setPlayerOnline(state: GameState, id: string, isOnline: boolean): void {
		state.players[id]!.online = isOnline;
	}

	export function addCard(state: GameState, card: Card): void {
		state.cards[card.id] = card;
	}

	export function updateCard(state: GameState, card: Card): void {
		state.cards[card.id] = card;
	}
	
	export function getPlayers(state: GameState): Array<string> {
		return Object.keys(state.players);
	}
	
	export function getActivePlayers(state: GameState): Array<string> {
		return getPlayers(state).filter(id => state.players[id] && state.players[id]!.online);
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
		return getPlayer(state, playerId).hp;
	}

	export function getPreviousHP(state: GameState, playerId: string): number {
		return getPlayer(state, playerId).prevHp;
	}

	export function setHP(state: GameState, playerId: string, hp: number): void {
		if (hp < 0) hp = 0;
		let player = getPlayer(state, playerId);
		player.prevHp = player.hp;
		player.hp = hp;
	}

	export function setPresence(state: GameState, playerId: string, presence: nkruntime.Presence): void {
		getPlayer(state, playerId).presence = presence;
   	}

	export function removePresence(state: GameState, playerId: string): void {
		delete getPlayer(state, playerId).presence;
   	}

	export function hasPresence(state: GameState, playerId: string): boolean {
		return !!getPlayer(state, playerId).presence;
	}

	export function getPresence(state: GameState, playerId: string): nkruntime.Presence {
		let presence = getPlayer(state, playerId).presence;
		if (!presence) {
			throw new Error("Player has no presence!");
		}
 		return presence;
	}
	// #endregion
	
	export function getZones(state: GameState, ownerId?: string): Array<CardZone> {
		if (!ownerId) {
			return Match.getActivePlayers(state).map(id => getZones(state, id)).reduce((z1, z2) => z1.concat(z2), []);
		}

		let playerData = getPlayer(state, ownerId);
		return [
			playerData.hand, playerData.mainDeck, playerData.recipeDeck, playerData.trash, ...playerData.serveZones, ...playerData.standbyZone
		];
	}

	export function findZones(state: GameState, location: CardLocation, ownerId?: string, column?: number | null): Array<CardZone> {
		if (location === CardLocation.VOID) {
			return [];
		}
		let filterColumn: boolean = column !== null && column !== undefined;
		// Filter in any zone that has any location specified in the location parameter
		// And if column parameter is specified, filter in only zones with the same column
		let zones = getZones(state, ownerId);
		let foundZones = zones.filter(zone => Utility.bitMaskIntersects(zone.location, location) && (!filterColumn || (column === zone.column)));
		//state.log?.debug("findZones called with location: %d, got zone with the following locations and size: %s", location, foundZones.map(z => "" + z.location + "," + z.cards.length).reduce((l1, l2) => l1 + " " + l2, ""));
		return foundZones;
	}

	export function moveCard(state: GameState, cards: Array<Card>, targetLocation: CardLocation, targetPlayerId: string, column?: number | null, insertLocation?: "top" | "bottom" | "shuffle") {
		insertLocation = insertLocation || "top";

		let targetZones = findZones(state, targetLocation, targetPlayerId, column);
		let targetZone: CardZone | undefined = targetZones.length === 0 ? undefined : targetZones[0];

		// remove each card from their previous zone
		cards.forEach(card => {
			let oldLocation = Card.getLocation(card);
			let oldZone = findZones(state, oldLocation, Card.getOwner(card), Card.getColumn(card))
			if (oldZone.length > 0) {
				oldZone[0].cards = oldZone[0].cards.filter(cardInZone => cardInZone !== card.id);
			}
		});

		// assign new zone for each card
		// this should be assigned before putting into zone first because if not the data will somehow not persists idkw but i want to die now
		cards.forEach(card => {
			card.location = (targetZone ? targetZone.location : CardLocation.VOID);
			card.column = (targetZone ? targetZone.column : 0);
			Match.updateCard(state, card)
		});

		// place a card in the new zone
		if (targetZone) {
			switch (insertLocation) {
				case "top":
					targetZone.cards = targetZone.cards.concat(cards.map(c => c.id));
					break;
				case "bottom":
					targetZone.cards = cards.map(c => c.id).concat(targetZone.cards);
					break;
				case "shuffle":
					targetZone.cards = targetZone.cards.concat(cards.map(c => c.id));
					targetZone.cards = Utility.shuffle(targetZone.cards)
					break;
			}
		}

	}

	export function getCards(state: GameState, location: CardLocation, ownerId?: string, column?: number): Array<Card> {
		let targetZones = findZones(state, location, ownerId, column);
		return targetZones.map(zone => zone.cards).map(cards => cards.map(cardId => findCardByID(state, cardId)!)).reduce((prev, cur) => prev.concat(cur), []);
		
	}

	export function findCards(state: GameState, filterCondition: (card: Card) => boolean, location: CardLocation, ownerId: string, column?: number): Array<Card> {
		let targetZones = findZones(state, location, ownerId, column);
		// Same as getCards but add filter mapping in-between map and reduce
		return targetZones.map(zone => zone.cards).map(cards => cards.map(cardId => findCardByID(state, cardId)!)).map(cards => cards.filter(filterCondition)).reduce((prev, cur) => prev.concat(cur), []);
	}

	/**
	 * Returns the first card with the specified id from a given game state
	 * @param state 
	 * @param id 
	 * @param location 
	 * @param ownerId 
	 * @param column 
	 * @returns 
	 */
	export function findCardByID(state: GameState, id: CardID): Card | null {
		let foundCard = state.cards[id];
		return (foundCard ? foundCard : null);
		/** 
		let targetZones = findZones(state, location, ownerId, column);
		for (let zone of targetZones) {
			let cards = zone.cards;
			let foundCards = cards.filter(card => card.id === id);
			if (foundCards.length > 0) {
				return foundCards[0];
			}
		}
		return null;*/
	}

	export function findCardsById(state: GameState, ids: Array<CardID>): Array<Card> {
		return ids.map(id => findCardByID(state, id)).filter(card => card !== null).map(card => card!);
	}

	export function getTopCards(state: GameState, count: number, location: CardLocation, ownerId: string, column?: number): Array<Card> {
		let cards = getCards(state, location, ownerId, column);
		count = Math.min(count, cards.length);
		return cards.slice(-count);
	}

	export function gotoNextTurn(state: GameState): void {
		state.turnCount += 1;
		state.turnPlayer = getOpponent(state, state.turnPlayer);
	}

	export function isEnded(state: GameState): boolean {
		return state.status === "ended";
	}

	export function isWinner(state: GameState, playerId: string): boolean {
		if (state.status !== "ended") return false;
		return (!!state.endResult && state.endResult.winners.some(winnerId => winnerId === playerId));
	}

	export function getEndReason(state: GameState): string {
		return (state.endResult ? state.endResult.reason : "UNKNOWN");
	}
	
	export function getFreeZoneCount(state: GameState, playerId: string, location: CardLocation): number {
		return findZones(state, location, playerId).filter(zone => zone.cards.length === 0).length;
	}

	export function getFreeColumns(state: GameState, playerId: string, location: CardLocation): Array<number> {
		return findZones(state, location, playerId).filter(zone => zone.cards.length === 0).map(zone => zone.column);
	}

	export function isZoneEmpty(state: GameState, location: CardLocation, playerId: string, column: number): boolean {
		return findZones(state, location, playerId, column).some(zone => zone.cards.length === 0);
	}

}