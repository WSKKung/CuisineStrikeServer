import { CardID, Card, CardType  } from "./model/cards";
import { EventReason, GameEvent } from "./model/events";
import { CardZone, Field } from "./model/field";
import { CardLocation } from "./model/cards";
import { GameConfiguration } from "./constants";
import { ArrayUtil, BitField, Utility } from "./utility";
import { BUFF_ID_DAMAGED, CardBuff, CardBuffResetCondition as CardBuffResetFlag } from "./buff";
import { CardEffect, CardEffectContext, CardEffectInstance, CardEffectUseLimit } from "./model/effect";
import { PlayerRequest } from "./model/player_request";

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
	buffs: {[id: CardID]: Array<CardBuff>},
	effects: {[id: CardID]: Array<CardEffectInstance>},
	attackCount: {[id: CardID]: number}
	status: "init" | "running" | "ended",
	turnPlayer: string,
	turnCount: number,
	turnPhase: TurnPhase
	endResult: GameResult | null,
	eventQueue: Array<GameEvent>,
	currentChoiceRequest?: PlayerRequest,
	nextHintMessage?: string
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
	cardRequest?: {
		min: number,
		max: number,
		cards: Array<Card>,
		callback: (chosenCards: Array<Card>) => void
	},
	timeout: number,
	online: boolean
}

export type TurnPhase = "setup" | "strike"

export function getPlayerId(presence: nkruntime.Presence): string {
	return presence.userId;
}

export namespace Match {

	function createPlayerData(id: string): PlayerData {
		let hand = Field.createZone(id, CardLocation.HAND);
		let mainDeck = Field.createZone(id, CardLocation.MAIN_DECK);
		let recipeDeck = Field.createZone(id, CardLocation.RECIPE_DECK);
		let trash = Field.createZone(id, CardLocation.TRASH);
		let serveZones: Array<CardZone> = [];
		let standbyZone: Array<CardZone> = [];
		for (let col = 0; col < GameConfiguration.boardColumns; col++) {
			serveZones.push(Field.createZone(id, CardLocation.SERVE_ZONE, col));
			standbyZone.push(Field.createZone(id, CardLocation.STANDBY_ZONE, col));
		}
		return {
			id,
			hp: GameConfiguration.initialHP,
			prevHp: GameConfiguration.initialHP,
			online: false,
			timeout: GameConfiguration.timeout.fixed + GameConfiguration.timeout.byTurn,
			hand, mainDeck, recipeDeck, trash, serveZones, standbyZone
		};
	}

	export function createState(): GameState {
		return {
			playerData: {},
			players: {},
			cards: {},
			buffs: {},
			effects: {},
			status: "init",
			turnPlayer: "",
			turnCount: 0,
			turnPhase: "setup",
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
		state.buffs[card.id] = [];
		state.effects[card.id] = [];
	}

	export function updateCard(state: GameState, card: Card): void {
		state.cards[card.id] = card;
	}

	export function reapplyBuffs(state: GameState, card: Card) {
		Card.resetProperties(card);

		let buffs = getBuffs(state, card);
		//state.log?.debug("reapplyBuff: buffs: %s", JSON.stringify(buffs))
		for (let buff of buffs) {
			CardBuff.applyToCard(state, card, buff);
		}

		// Bonus stat from grade
		let bonusGrade = Card.getBonusGrade(card);
		let bonusPower = bonusGrade * Card.getBonusPower(card);
		let bonusHealth = bonusGrade * Card.getBonusHealth(card);

		Card.setPower(card, Card.getPower(card) + bonusPower);
		Card.setHealth(card, Card.getHealth(card) + bonusHealth);
		
		// Caps final stat
		if (Card.getPower(card) < 0) Card.setPower(card, 0)
		if (Card.getHealth(card) < 0) Card.setHealth(card, 0)
		if (Card.getGrade(card) < 0) Card.setGrade(card, 0)
	}

	export function registerEffect(state: GameState, card: Card, effect: CardEffect): void {
		let effect_instance = CardEffectInstance.create(effect, card);
		if (effect.type === "activate") {
			effect_instance.limits = CardEffectUseLimit.ONCE_PER_TURN;
			effect_instance.satisfiedLimits = 0;
		}
		state.effects[card.id] = state.effects[card.id].concat(effect_instance);
	}

	export function getEffectByType(state: GameState, card: Card, type: CardEffect["type"]): Array<CardEffectInstance> {
		return state.effects[card.id].filter(e => e.effect.type === type);
	}

	export function updateCards(state: GameState, cards: Array<Card>, reason: number, reasonPlayer: string) {
		// Fires update hook
		Match.discard(state, cards.filter(card => card.location === CardLocation.SERVE_ZONE && Card.getHealth(card) <= 0), "", EventReason.DESTROYED | reason);

		state.eventQueue.push({ id: newUUID(state), type: "update_card", cards: cards, reason: reason, sourcePlayer: reasonPlayer })
	}

	export function isAbilityUseable(state: GameState, playerId: string, effect: CardEffectInstance): boolean {
		let activateCtx: CardEffectContext = { state: state, player: playerId, card: effect.card };
		return CardEffectInstance.canUse(effect) && Card.canPosibblyActivateEffect(effect.card) && effect.effect.type === "activate" && CardEffectInstance.checkCondition(effect, activateCtx);
	}

	export function hasUseableActivateAbility(state: GameState, playerId: string, card: Card): boolean {
		return state.effects[card.id].some(e => isAbilityUseable(state, playerId, e));
	}
	
	export function activateAbility(state: GameState, playerId: string, card: Card): void {
		let activateCtx: CardEffectContext = { state: state, player: playerId, card: card };
		let firstUseableEffect = state.effects[card.id].find(e => isAbilityUseable(state, playerId, e));
		if (!firstUseableEffect) {
			return;
		}
		
		resolveAbility(state, firstUseableEffect!);
	}


	export async function resolveAbility(state: GameState, effect: CardEffectInstance, event?: GameEvent) {
		let card = effect.card;
		let playerId = card.owner;
		let ctx: CardEffectContext = {
			state: state, card: card, player: playerId, event: event
		};

		let activateEvent: GameEvent = { 
			id: Match.newUUID(state), 
			type: "activate", card: card, 
			reason: EventReason.ACTIVATE, 
			sourcePlayer: playerId 
		}
		state.eventQueue.push(activateEvent);
		await effect.effect.activate(ctx);

		// discard if is action or trigger activated from hand
		if (Card.hasType(card, CardType.ACTION | CardType.TRIGGER) && Card.hasLocation(card, CardLocation.HAND)) {
			Match.discard(state, [card], playerId, EventReason.GAMERULE);
		}

		CardEffectInstance.setLimitReached(effect, CardEffectUseLimit.ONCE_PER_TURN);
	}
	export function damage(state: GameState, cards: Array<Card>, amount: number, reason: EventReason, reasonPlayer: string) {
		if (amount <= 0) return;
		for (let card of cards) {
			if (!Card.hasLocation(card, CardLocation.SERVE_ZONE)) {
				continue;
			}
			card.damage += amount;
			let damagedBuff: CardBuff = {
				id: BUFF_ID_DAMAGED,
				sourceCard: null,
				type: "health",
				operation: "add",
				amount: -amount,
				resets: CardBuffResetFlag.TARGET_REMOVED
			};
			addBuff(state, [card], damagedBuff);
		}
		Match.updateCards(state, cards, reason, reasonPlayer);
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

	export function getRandomPlayer(state: GameState): string {
		var players = getActivePlayers(state);
		return players[Math.floor(Math.random() * players.length)]
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
		state.eventQueue.push({ id: newUUID(state), type: "update_hp", sourcePlayer: reasonPlayer, player: playerId, reason: reason, amount: hp })
	}

	export function restoreHP(state: GameState, playerId: string, hp: number, reason: EventReason, reasonPlayer: string): void {
		let oldHP = getHP(state, playerId);
		setHP(state, playerId, oldHP + hp, reason, reasonPlayer);
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
		let foundZones = zones.filter(zone => BitField.any(zone.location, location) && (!filterColumn || (column === zone.column)));
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
			
			if (BitField.any(oldLocation, CardLocation.ON_FIELD) && !BitField.any(zone.location, CardLocation.ON_FIELD)) {
				// left the field
				state.log?.debug("card left the field: %s", Card.getName(card))
				removeBuffs(state, [card], buff => BitField.any(buff.resets, CardBuffResetFlag.TARGET_REMOVED));
				removeBuffs(state, getCards(state, CardLocation.ON_FIELD), buff => buff.sourceCard === card && BitField.any(buff.resets, CardBuffResetFlag.SOURCE_REMOVED));
				// reset effect limit
				for (let effect of state.effects[card.id]) {
					CardEffectInstance.restoreAllLimits(effect);
				}
			
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

	export function sendToDeck(state: GameState, cards: Array<Card>, targetPlayer: string, insertLocation: "top" | "bottom" | "shuffle", reason: number, reasonPlayer: string = targetPlayer) {
		// seperate card by the target deck location it should bew sent to
		let seperatedCards = ArrayUtil.seperate(cards, (card) => Card.hasType(card, CardType.DISH));
		// belongs in recipe deck
		moveCard(state, seperatedCards[1], CardLocation.RECIPE_DECK, targetPlayer, null, insertLocation);
		// belongs in main deck
		moveCard(state, seperatedCards[0], CardLocation.MAIN_DECK, targetPlayer, null, insertLocation);
		updateCards(state, cards, reason, reasonPlayer);
	}

	export function discard(state: GameState, cards: Array<Card>, playerId: string, reason: number) {
		if (cards.length === 0) return;
		for (let card of cards) {
			moveCardToZone(state, [card], getPlayer(state, Card.getOwner(card)).trash);
			// reset
			Card.resetProperties(card);
		}
		updateCards(state, cards, reason, playerId);
		// TODO: Queue send to trash event
		
		//state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "discard", cards: cards, reason });
		
	}

	export function setToStandby(state: GameState, card: Card, playerId: string, column: number) {
		// TODO: Queue set event
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "set", reason: EventReason.SET, card: card, column: column });

		let zone = getPlayer(state, playerId).standbyZone[column];
		if (!zone) {
			return;
		}
		moveCardToZone(state, [card], zone);
		updateCards(state, [card], EventReason.SET, playerId);
	}

	export function summon(state: GameState, card: Card, playerId: string, column: number, reason: EventReason, isQuickSet: boolean = false) {
		let zone = isQuickSet ? getPlayer(state, playerId).standbyZone[column] : getPlayer(state, playerId).serveZones[column];
		if (!zone) {
			return;
		}

		// TODO: Queue summon event
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "summon", reason: reason | EventReason.SUMMON, card: card, column: column });

		moveCardToZone(state, [card], zone);

		// allow attack on owner turn and turn 2 or onward only
		if (Match.isPlayerTurn(state, Card.getOwner(card)) && state.turnCount > 1) {
			resetCardAttackCount(state, card);
		}

		updateCards(state, [card], reason, playerId);
	}

	export function getCards(state: GameState, location: CardLocation, ownerId?: string, column?: number): Array<Card> {
		let targetZones = findZones(state, location, ownerId, column);
		return targetZones.map(zone => zone.cards).map(cards => cards.map(cardId => findCardByID(state, cardId)!)).reduce((prev, cur) => prev.concat(cur), []);
	}

	export function countCards(state: GameState, location: CardLocation, ownerId?: string, column?: number): number {
		let targetZones = findZones(state, location, ownerId, column);
		return targetZones.map(zone => zone.cards.length).reduce((prev, cur) => prev + cur, 0);
	}

	export function findCards(state: GameState, filterCondition: (card: Card) => boolean, location: CardLocation, ownerId?: string, column?: number): Array<Card> {
		let targetZones = findZones(state, location, ownerId, column);
		// Same as getCards but add filter mapping in-between map and reduce
		return targetZones.map(zone => zone.cards).map(cards => cards.map(cardId => findCardByID(state, cardId)!)).map(cards => cards.filter(filterCondition)).reduce((prev, cur) => prev.concat(cur), []);
	}

	export function countFilterCards(state: GameState, filterCondition: (card: Card) => boolean, location: CardLocation, ownerId?: string, column?: number): number {
		let targetZones = findZones(state, location, ownerId, column);
		return targetZones.map(zone => zone.cards).map(cards => cards.map(cardId => findCardByID(state, cardId)!)).map(cards => cards.filter(filterCondition)).map(cards => cards.length).reduce((prev, cur) => prev + cur, 0);
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
		let drewCount = drewCards.length;
		state.log?.debug("draw card: expected = %d, actual = %d", count, drewCount);
		// Decked out if requested top card has less card than the required count
		if (drewCount < count) {
			end(state, {
				winners: Match.getActivePlayers(state).filter(otherPlayerId => otherPlayerId !== playerId),
				reason: "DECKED_OUT"
			});
			return 0;
		}

		Match.moveCard(state, drewCards, CardLocation.HAND, playerId);
		updateCards(state, drewCards, EventReason.DRAW, playerId);
		//state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, type: "to_hand", cards: drewCards.map(card => card.id) });
		return drewCards.length;
	}

	export function fillHand(state: GameState, playerId: string, size: number, min: number = 0): number {
		// Draw until player has a fixed number of cards in their hand, capped at minimum by min.
		let handSize = getPlayer(state, playerId).hand.cards.length;
		let drawSize = Math.max(size - handSize, min);
		return Match.drawCard(state, playerId, drawSize);
	}

	export function goToSetupPhase(state: GameState, playerId: string) {
		state.turnPhase = "setup";
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, reason: EventReason.GAMERULE, type: "change_phase", phase: state.turnPhase });
	}

	export function goToStrikePhase(state: GameState, playerId: string) {
		state.turnPhase = "strike";
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, reason: EventReason.GAMERULE, type: "change_phase", phase: state.turnPhase });
	}

	export function gotoNextTurn(state: GameState, playerId: string): void {
		endTurn(state);

		let nextTurnPlayer = getOpponent(state, state.turnPlayer);
		state.turnCount += 1;
		state.turnPlayer = nextTurnPlayer;
		state.eventQueue.push({ id: newUUID(state), sourcePlayer: playerId, reason: EventReason.GAMERULE, type: "change_turn", turn: state.turnCount, turnPlayer: state.turnPlayer});
		// TODO: Add hook
		beginTurn(state);
	}

	export function endTurn(state: GameState): void {
		removeBuffs(state, getCards(state, CardLocation.ON_FIELD), (buff) => BitField.any(buff.resets, CardBuffResetFlag.END_TURN));
		for (let cardId in state.effects) {
			for (let effect of state.effects[cardId]) {
				CardEffectInstance.restoreLimit(effect, CardEffectUseLimit.ONCE_PER_TURN);
			}
		}
	}

	export function beginTurn(state: GameState): void {
		let turnPlayer = getTurnPlayer(state);
		// reset timer
		let maxTimeout = GameConfiguration.timeout.fixed + GameConfiguration.timeout.byTurn
		state.players[turnPlayer]!.timeout = Math.min(maxTimeout, (state.players[turnPlayer]!.timeout - GameConfiguration.timeout.fixed) + GameConfiguration.timeout.byTurn);

		goToSetupPhase(state, turnPlayer);
		fillHand(state, turnPlayer, GameConfiguration.drawSizePerTurns, 1);
		resetPlayerCardAttackCount(state, turnPlayer);
	}

	export function end(state: GameState, result: GameResult) {
		state.status = "ended";
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

	export function isCardCanSetAsIngredient(state: GameState, card: Card): boolean {
		if (!Card.hasType(card, CardType.INGREDIENT)) {
			return false;
		}
		if (Card.hasType(card, CardType.DISH)) {
			return Card.hasLocation(card, CardLocation.RECIPE_DECK | CardLocation.SERVE_ZONE);
		}
		return Card.hasLocation(card, CardLocation.HAND);
	}

	export function isCardCanCookSummon(state: GameState, card: Card): boolean {
		return Card.hasType(card, CardType.DISH) && Card.hasLocation(card, CardLocation.RECIPE_DECK);
	}

	export function isCardCanAttack(state: GameState, card: Card): boolean {
		if (!Card.hasLocation(card, CardLocation.SERVE_ZONE)) {
			return false;
		}
		if (!isStrikePhase(state)) {
			return false;
		}
		return card.attacks > 0
	}

	export function isCardCanActivateAbility(state: GameState, card: Card): boolean {
		if (!Match.isSetupPhase(state) || !Match.isPlayerTurn(state, card.owner)) {
			return false;
		}
		switch (Card.getType(card)) {
			case CardType.ACTION:
				if (!Card.hasLocation(card, CardLocation.HAND)) {
					return false;
				}
				break;
			case CardType.DISH:
			case CardType.INGREDIENT:
			case CardType.INGREDIENT_DISH:
				if (!Card.hasLocation(card, CardLocation.ON_FIELD)) {
					return false;
				}
				break;
			default:
				return false;
		};

		return hasUseableActivateAbility(state, card.owner, card);
	}
	
	export function resetPlayerCardAttackCount(state: GameState, playerId: string) {
		let cardsToBeReset = getCards(state, CardLocation.SERVE_ZONE, playerId);
		cardsToBeReset.forEach(card => {
			resetCardAttackCount(state, card);
		});
		updateCards(state, cardsToBeReset, EventReason.GAMERULE, playerId);
	}
	
	export function resetCardAttackCount(state: GameState, card: Card) {
		card.attacks = 1;
		updateCard(state, card)
	}

	export function removeCardAttackCount(state: GameState, card: Card) {
		card.attacks -= 1;
		if (card.attacks < 0) {
			card.attacks = 0;
		}
		updateCard(state, card)
	}

	export function battle(state: GameState, playerId: string, attackingCard: Card, targetCard: Card) {
		if (!isCardCanAttack(state, attackingCard)) {
			return;
		}
		
		// TODO: Add hook event here
		let declareAttackEvent: GameEvent & { type: "declare_attack" } = { 
			id: newUUID(state), 
			type: "declare_attack",
			sourcePlayer: playerId, 
			reason: EventReason.BATTLE, 
			attackingCard: attackingCard, 
			isDirect: false, 
			targetCard: targetCard,
			canceled: false
		};
		
		state.eventQueue.push(declareAttackEvent);
		makePlayersSelectTriggerAbility(state, declareAttackEvent).then(() => {
			state.log?.debug(JSON.stringify(declareAttackEvent));
			if (!declareAttackEvent.canceled && isCardCanAttack(state, attackingCard)) {
				let attackEvent: GameEvent = {
					id: newUUID(state), 
					type: "attack",
					sourcePlayer: playerId, 
					reason: EventReason.BATTLE, 
					attackingCard: attackingCard, 
					isDirect: false, 
					targetCard: targetCard,
					canceled: false
				}
				state.eventQueue.push(attackEvent);

				let targetPower = Card.getPower(targetCard);
				let attackerPower = Card.getPower(attackingCard);

				damage(state, [attackingCard], targetPower, EventReason.BATTLE, playerId);
				damage(state, [targetCard], attackerPower, EventReason.BATTLE, playerId);				
			}
			removeCardAttackCount(state, attackingCard);
		});

	}

	export function attackPlayer(state: GameState, playerId: string, attackingCard: Card, targetPlayerId: string) {
		if (!isCardCanAttack(state, attackingCard)) {
			return;
		}
		// TODO: Add hook event here
		let attackDeclareEvent: GameEvent & { type: "declare_attack" } = { 
			id: newUUID(state), 
			type: "declare_attack",
			sourcePlayer: playerId, 
			reason: EventReason.BATTLE, 
			attackingCard: attackingCard, 
			isDirect: true, 
			targetPlayer: targetPlayerId,
			canceled: false
		};
		state.eventQueue.push(attackDeclareEvent);

		makePlayersSelectTriggerAbility(state, attackDeclareEvent).then(() => {
			if (!attackDeclareEvent.canceled && isCardCanAttack(state, attackingCard)) {
				let attackEvent: GameEvent = {
					id: newUUID(state), 
					type: "attack",
					sourcePlayer: playerId, 
					reason: EventReason.BATTLE, 
					attackingCard: attackingCard, 
					isDirect: true, 
					targetPlayer: targetPlayerId,
					canceled: false
				}
				state.eventQueue.push(attackEvent);
				let attackerPower = Card.getPower(attackingCard);
				Match.setHP(state, targetPlayerId, Match.getHP(state, targetPlayerId) - attackerPower, EventReason.BATTLE, playerId);			
			}
			removeCardAttackCount(state, attackingCard);
		});
		
	}

	export function isSetupPhase(state: GameState): boolean {
		return state.turnPhase === "setup"
	}

	export function isStrikePhase(state: GameState): boolean {
		return state.turnPhase === "strike"
	}

	export function addBuff(state: GameState, cards: Array<Card>, buff: CardBuff) {
		for (let card of cards) {
			state.buffs[card.id] = state.buffs[card.id].concat(buff)
			//state.log?.debug("addBuff: buffs: %s", JSON.stringify(state.buffs[card.id]))
			//state.log?.debug("addBuff: buffs: %s", JSON.stringify(getBuffs(state, card)))
			reapplyBuffs(state, card);
		}
		updateCards(state, cards, EventReason.UNSPECIFIED, "");
	}

	export function getBuffs(state: GameState, card: Card): Array<CardBuff> {
		return state.buffs[card.id];
	}

	export function removeBuffs(state: GameState, cards: Array<Card>, condition: (buff: CardBuff) => boolean) {
		for (let card of cards) {
			let prevLen = state.buffs[card.id].length
			state.buffs[card.id] = state.buffs[card.id].filter(buff => !condition(buff));
			let nowLen = state.buffs[card.id].length
			if (prevLen > nowLen) 
				state.log?.debug("removeBuffs from %s: from %d to -> %d", Card.getName(card), prevLen, nowLen)
			reapplyBuffs(state, card);
		}
		updateCards(state, cards, EventReason.UNSPECIFIED, "");
	}

	export function getBuffById(state: GameState, card: Card, id: string): CardBuff | null {
		let result = state.buffs[card.id].find(buff => buff.id === id);
		return result || null;
	}

	export function setSelectionHint(state: GameState, hintMessage: string): void {
		state.nextHintMessage = hintMessage;
	}

	export function popSelectionHint(state: GameState): string {
		let hint = state.nextHintMessage || "";
		state.nextHintMessage = undefined;
		return hint;
	}

	function dispatchPlayerRequest(state: GameState, playerId: string, request: PlayerRequest) {
		if (state.currentChoiceRequest != null) {
			return;
		}
		state.currentChoiceRequest = request;
		state.eventQueue.push({ 
			id: newUUID(state), 
			type: "request_choice", 
			sourcePlayer: playerId, 
			reason: EventReason.UNSPECIFIED, 
			player: request.playerId,
			hint: request.hint,
			request: request,
		});
	}

	export async function makePlayerSelectCards(state: GameState, playerId: string, cards: Array<Card>, min: number, max: number = min): Promise<Array<Card>> {
		let hintMsg = popSelectionHint(state);
		return new Promise((resolve) => {
			let newRequest: PlayerRequest = {
				type: "cards",
				playerId: playerId,
				hint: hintMsg,
				min: min,
				max: max,
				cards: cards,
				callback: (selectedCards: Array<Card>) => {
					state.currentChoiceRequest = undefined;
					resolve(selectedCards);
				}
			};
			dispatchPlayerRequest(state, playerId, newRequest);
		});
	}

	export async function makePlayerSelectFreeZone(state: GameState, playerId: string, location: number, ownerId: string = playerId): Promise<CardZone> {
		let zones = findZones(state, location, ownerId).filter(zone => zone.cards.length === 0);
		let hintMsg = popSelectionHint(state);
		const selectAmount = 1;
		return new Promise((resolve) => {
			let newRequest: PlayerRequest = {
				type: "zones",
				playerId: playerId,
				hint: hintMsg,
				min: selectAmount,
				max: selectAmount,
				zones: zones,
				callback: (selectedZones: Array<CardZone>) => {
					state.currentChoiceRequest = undefined;
					resolve(selectedZones[0]);
				}
			};
			dispatchPlayerRequest(state, playerId, newRequest);
			
		});
	}

	export async function makePlayerSelectYesNo(state: GameState, playerId: string): Promise<boolean> {
		let hintMsg = popSelectionHint(state);
		// state.eventQueue.push({ 
		// 	id: newUUID(state), 
		// 	type: "request_choice", 
		// 	sourcePlayer: playerId, 
		// 	player: playerId, 
		// 	hint: popSelectionHint(state),
		// 	request: "yes_no",
		// 	reason: EventReason.UNSPECIFIED, 
		// });
		return new Promise((resolve) => {
			let newRequest: PlayerRequest = {
				type: "yes_no",
				hint: hintMsg,
				playerId: playerId,
				callback: (choice: boolean) => {
					state.currentChoiceRequest = undefined;
					resolve(choice);
				}
			};
			dispatchPlayerRequest(state, playerId, newRequest);
		});
	}

	export async function makePlayerSelectOption(state: GameState, playerId: string, options: Array<string>): Promise<number> {
		let hintMsg = popSelectionHint(state);
		// state.eventQueue.push({ 
		// 	id: newUUID(state), 
		// 	type: "request_choice", 
		// 	sourcePlayer: playerId, 
		// 	player: playerId, 
		// 	hint: popSelectionHint(state),
		// 	request: "option",
		// 	options: options, 
		// 	reason: EventReason.UNSPECIFIED, 
		// });
		return new Promise((resolve) => {
			let newRequest: PlayerRequest = {
				type: "option",
				hint: hintMsg,
				playerId: playerId,
				options: options,
				callback: (choice: number) => {
					state.currentChoiceRequest = undefined;
					resolve(choice);
				}
			};
			dispatchPlayerRequest(state, playerId, newRequest);
		});
	}

	export function isTriggerAbilityUseable(state: GameState, playerId: string, effect: CardEffectInstance, event: GameEvent): boolean {
		let activateCtx: CardEffectContext = { state: state, player: playerId, card: effect.card, event: event };
		return CardEffectInstance.canUse(effect) && 
			Card.canPosibblyActivateEffect(effect.card) && 
			effect.effect.type === "trigger" && 
			CardEffectInstance.checkCondition(effect, activateCtx);
	}

	
	export async function makePlayersSelectTriggerAbility(state: GameState, event: GameEvent) {
		let applicableTriggerEffects = Object.values(state.effects).flat(1).filter((e) => {
			if (e.effect.type === "trigger") {
				return isTriggerAbilityUseable(state, e.card.owner, e, event);
			}
			return false;
		});
		
		let triggerEffectsGroupedByOwner = ArrayUtil.group(applicableTriggerEffects, e => Card.getOwner(e.card));
		// prioritize opponent of event source, or turn player if event is caused by the game itself
		let firstPlayer = event.sourcePlayer ? getOpponent(state, event.sourcePlayer) : getTurnPlayer(state);
		let secondPlayer = getOpponent(state, firstPlayer);

		for (let player of [firstPlayer, secondPlayer]) {
			let playerEffects = triggerEffectsGroupedByOwner[player];
			if (playerEffects && playerEffects.length > 0) {
				setSelectionHint(state, "HINT_ACTIVATE_TRIGGER");
				let selected = await makePlayerSelectCards(state, player, playerEffects.map(e => e.card), 0, 1);
				// activate effect if any is selected
				if (selected.length > 0) {
					let triggeringCard = selected[0];
					let triggeringAbility = state.effects[triggeringCard.id][0];
					
					await resolveAbility(state, triggeringAbility, event);
					// skip any remaining to restrict one trigger effect on any action at the time
					return;
				}
			}			
		}
		return
	}

	export function isWaitingPlayerChoice(state: GameState, playerId?: string): boolean {
		return !!state.currentCardRequest && (!playerId || state.currentCardRequest.playerId === playerId);
	}
}