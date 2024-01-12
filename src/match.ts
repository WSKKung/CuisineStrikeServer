import { CardID, Card } from "./card";
import { EventReason, GameEvent, GameEventListener, GameEventType } from "./event_queue";
import { CardZone, Field } from "./field";
import { CardLocation } from "./card";
import { GameConfiguration } from "./constants";
import { Utility } from "./utility";

export interface GameResult {
	winners: Array<string>,
	reason: string
}

export interface GameState extends nkruntime.MatchState {
	//TODO: Decoupling GameState from Nakama state altogether
	log?: nkruntime.Logger,
	nk?: nkruntime.Nakama,
	players: {[id: string]: PlayerData | undefined},
	cards: {[id: CardID]: Card},
	attackCount: {[id: CardID]: number}
	status: "init" | "running" | "ended",
	turnPlayer: string,
	turnCount: number,
	endResult: GameResult | null,
	eventQueue: Array<GameEvent>
}

export interface PlayerData {
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

export function getPlayerId(presence: nkruntime.Presence): string {
	return presence.sessionId;
}

export namespace Match {

	function createPlayerData(id: string): PlayerData {
		let hand = Field.createZone(CardLocation.HAND);
		let mainDeck = Field.createZone(CardLocation.MAIN_DECK);
		let recipeDeck = Field.createZone(CardLocation.RECIPE_DECK);
		let trash = Field.createZone(CardLocation.TRASH);
		let serveZones: Array<CardZone> = [];
		let standbyZone: Array<CardZone> = [];
		for (let col = 0; col < GameConfiguration.boardColumns; col++) {
			serveZones.push(Field.createZone(CardLocation.SERVE_ZONE, col));
			standbyZone.push(Field.createZone(CardLocation.STANDBY_ZONE, col));
		}
		return {
			id,
			hp: GameConfiguration.initialHP,
			prevHp: GameConfiguration.initialHP,
			online: false,
			hand, mainDeck, recipeDeck, trash, serveZones, standbyZone
		};
	}

	
	export function createState(): GameState {
		let eventListeners: {[eventType in GameEventType]: Array<GameEventListener<eventType>>};
		return {
			playerData: {},
			players: {},
			cards: {},
			status: "init",
			turnPlayer: "",
			turnCount: 0,
			endResult: null,
			lastAction: null,
			eventQueue: [],
			attackCount: {}
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

	export function updateCards(state: GameState, cards: Array<Card>, reason: EventReason, reasonPlayer: string) {
		state.log?.debug("update card: %s", JSON.stringify(state.eventQueue.length));
		cards.forEach(card => {
			//updateCard(state, card);
		});
		state.eventQueue.push({ id: newUUID(state), type: "update_card", cards: cards.map(card => card.id), reason: reason, sourcePlayer: reasonPlayer })
		state.log?.debug("update card: %s", JSON.stringify(state.eventQueue.length));
	}
	
	export function damage(state: GameState, cards: Array<Card>, amount: number, reason: EventReason, reasonPlayer: string) {
		for (let card of cards) {
			if (!Card.hasLocation(card, CardLocation.SERVE_ZONE)) {
				continue;
			}
			let remainingHealth = Card.getHealth(card) - amount;
			Card.setHealth(card, remainingHealth);
		}
		Match.updateCards(state, cards, reason, reasonPlayer)
		Match.discard(state, cards.filter(card => Card.getHealth(card) === 0), "", "destroyed");
	}

	export function getPlayers(state: GameState): Array<string> {
		return Object.keys(state.players);
	}
	
	export function getActivePlayers(state: GameState): Array<string> {
		return getPlayers(state).filter(id => state.players[id] && state.players[id]!.online);
	}
	
	export function forEachPlayers(state: GameState, func: (playerId: string) => void) {
		getActivePlayers(state).forEach(func);
	}

	export function getTurnPlayer(state: GameState): string {
		return state.turnPlayer;
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

	export function setHP(state: GameState, playerId: string, hp: number, reason: EventReason, reasonPlayer: string): void {
		if (hp < 0) hp = 0;
		let player = getPlayer(state, playerId);
		player.prevHp = player.hp;
		player.hp = hp;
		state.eventQueue.push({ id: newUUID(state), type: "update_hp", sourcePlayer: reasonPlayer, player: playerId, reason: reason })
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

	function moveCardToZone(state: GameState, cards: Array<Card>, zone: CardZone, insertLocation?: "top" | "bottom" | "shuffle") {
		insertLocation = insertLocation || "top";
		// remove each card from their previous zone
		cards.forEach(card => {
			let oldLocation = Card.getLocation(card);
			let oldZone = findZones(state, oldLocation, Card.getOwner(card), Card.getColumn(card))
			if (oldZone.length > 0) {
				oldZone[0].cards = oldZone[0].cards.filter(cardInZone => cardInZone !== card.id);
			}
		});

		cards.forEach(card => {
			card.location = zone.location;
			card.column = zone.column;
			//Match.updateCard(state, card)
		});

		// place a card in the new zone
		switch (insertLocation) {
			case "top":
				zone.cards = zone.cards.concat(cards.map(c => c.id));
				break;
			case "bottom":
				zone.cards = cards.map(c => c.id).concat(zone.cards);
				break;
			case "shuffle":
				zone.cards = zone.cards.concat(cards.map(c => c.id));
				zone.cards = Utility.shuffle(zone.cards)
				break;
		}
	}

	export function moveCard(state: GameState, cards: Array<Card>, targetLocation: CardLocation, targetPlayerId: string, column?: number | null, insertLocation?: "top" | "bottom" | "shuffle") {
		let targetZones = findZones(state, targetLocation, targetPlayerId, column);
		let targetZone: CardZone | undefined = targetZones.length === 0 ? undefined : targetZones[0];
		if (targetZone) {
			moveCardToZone(state, cards, targetZone, insertLocation);
		}
	}

	export function discard(state: GameState, cards: Array<Card>, playerId: string, reason: EventReason) {
		if (cards.length === 0) return;
		for (let card of cards) {
			moveCardToZone(state, [card], getPlayer(state, Card.getOwner(card)).trash);
			// reset
			Card.resetProperties(card);
		}
		updateCards(state, cards, reason, playerId);
		// TODO: Queue send to trash event
		
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "discard", cards: cards.map(card => card.id) });
		
	}

	export function setToStandby(state: GameState, card: Card, playerId: string, column: number) {
		let zone = getPlayer(state, playerId).standbyZone[column];
		if (!zone) {
			return;
		}
		moveCardToZone(state, [card], zone);
		updateCards(state, [card], "set_ingredient", playerId);
		// TODO: Queue set event
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "set", card: card.id, column: column });
	}

	export function summon(state: GameState, card: Card, playerId: string, column: number, reason: EventReason) {
		let zone = getPlayer(state, playerId).serveZones[column];
		if (!zone) {
			return;
		}

		moveCardToZone(state, [card], zone);
		// allow attack on owner turn and turn 2 or onward only
		if (Card.getOwner(card) === Match.getTurnPlayer(state) && state.turnCount > 1) {
			resetCardAttackCount(state, card);
		}
		updateCards(state, [card], reason, playerId);
		// TODO: Queue summon event
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "summon", card: card.id, column: column });
	}

	export function getCards(state: GameState, location: CardLocation, ownerId?: string, column?: number): Array<Card> {
		let targetZones = findZones(state, location, ownerId, column);
		return targetZones.map(zone => zone.cards).map(cards => cards.map(cardId => findCardByID(state, cardId)!)).reduce((prev, cur) => prev.concat(cur), []);
	}

	export function countCards(state: GameState, location: CardLocation, ownerId?: string, column?: number): number {
		let targetZones = findZones(state, location, ownerId, column);
		return targetZones.map(zone => zone.cards.length).reduce((prev, cur) => prev + cur, 0);
		
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

	export function drawCard(state: GameState, playerId: string, count: number): number {
		let drewCards = getTopCards(state, count, CardLocation.MAIN_DECK, playerId);
		// Decked out if requested top card has less card than the required count
		if (drewCards.length < count) {
			Match.end(state, {
				winners: Match.getActivePlayers(state).filter(playerId => playerId !== playerId),
				reason: "DECKED_OUT"
			});
			return 0;
		}

		Match.moveCard(state, drewCards, CardLocation.HAND, playerId);
		state.log?.debug("draw card: %s", JSON.stringify(state.eventQueue.length));
		updateCards(state, drewCards, "draw", playerId);
		//state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "to_hand", cards: drewCards.map(card => card.id) });
		state.log?.debug("draw card: %s", JSON.stringify(state.eventQueue.length));
		return drewCards.length;
	}

	export function fillHand(state: GameState, playerId: string, size: number, min: number = 0): number {
		// Draw until player has a fixed number of cards in their hand, capped at minimum by min.
		let handSize = getPlayer(state, playerId).hand.cards.length;
		let drawSize = Math.max(size - handSize, min);
		return Match.drawCard(state, playerId, drawSize);
	}

	export function gotoNextTurn(state: GameState, playerId: string): void {
		state.turnCount += 1;
		state.turnPlayer = getOpponent(state, state.turnPlayer);
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "change_turn", turn: state.turnCount, turnPlayer: state.turnPlayer});
	}

	export function end(state: GameState, result: GameResult) {
		state.status === "ended";
		state.endResult = result;
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

	export function isZoneEmpty(state: GameState, location: CardLocation, playerId: string, column: number | null): boolean {
		return findZones(state, location, playerId, column).every(zone => zone.cards.length === 0);
	}

	export function isCardCanAttack(state: GameState, card: Card): boolean {
		return (state.attackCount[card.id] !== undefined) && state.attackCount[card.id] > 0;
	}
	
	export function resetPlayerCardAttackCount(state: GameState, playerId: string) {
		getCards(state, CardLocation.SERVE_ZONE, playerId).forEach(card => {
			resetCardAttackCount(state, card);
		});
	}
	
	export function resetCardAttackCount(state: GameState, card: Card) {
		state.attackCount[card.id] = 1;
	}

	export function removeCardAttackCount(state: GameState, card: Card) {
		state.attackCount[card.id] = state.attackCount[card.id] - 1;
	}

	export function battle(state: GameState, playerId: string, attackingCard: Card, targetCard: Card) {
		if (!isCardCanAttack(state, attackingCard)) {
			return;
		}
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "attack", attackingCard: attackingCard.id, directAttack: false, targetCard: targetCard.id });
		/** 
		let battlingCards = [ attackingCard, targetCard ];
		let destroyedCards: Card[] = []
		for (let i = 0; i < 2; i++) {
			let card = battlingCards[i];
			let opposingCard = battlingCards[2-i]
			let attackingPower = Card.getPower(card);
			let opposingHP = Card.getHealth(opposingCard);
			opposingHP -= attackingPower;
			Card.setHealth(opposingCard, opposingHP);
			if (opposingHP === 0) {
				destroyedCards.push(opposingCard);
			}
		}

		Match.updateCards(state, [ attackingCard ], "battle", playerId);
	`	
		Match.discard(state, destroyedCards, playerId, "battle_destroyed");
		*/
	}

	export function attackPlayer(state: GameState, playerId: string, attackingCard: Card, targetPlayerId: string) {
		if (!isCardCanAttack(state, attackingCard)) {
			return;
		}
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "attack", attackingCard: attackingCard.id, directAttack: true, targetPlayer: targetPlayerId });
	}

}