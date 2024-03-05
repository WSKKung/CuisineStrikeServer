import { CardID, Card, CardType  } from "./model/cards";
import { EventReason, GameEvent, GameEventContext } from "./model/events";
import { CardZone, Field } from "./model/field";
import { CardLocation } from "./model/cards";
import { GameConfiguration } from "./constants";
import { ArrayUtil, BitField, Utility } from "./utility";
import { BUFF_ID_DAMAGED, CardBuff, CardBuffResetCondition as CardBuffResetFlag } from "./buff";
import { CardEffect, CardEffectContext, CardEffectInstance, CardEffectUseLimit } from "./model/effect";
import { PlayerChoiceRequest, PlayerChoiceResponse, PlayerChoiceResponseValue, PlayerChoiceType } from "./model/player_request";
import { sendRequestChoiceAction } from "./communications/sender";
import { EndResultStringKeys } from "./communications/string_keys";

export interface GameResult {
	winners: Array<string>,
	reason: string
}

type EventQueue = Array<{
	event: GameEvent
	resolve(): void
	reject(): void
	resolved: boolean
}>

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
	eventQueue: EventQueue,
	resolvedEventQueue: EventQueue,
	activeRequest?: {
		request: PlayerChoiceRequest,
		response: PlayerChoiceResponse | null,
		dispatched: boolean
	} | null,
	nextHintMessage?: string,
	resolvingTriggerAbility: boolean
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
			players: {},
			cards: {},
			buffs: {},
			effects: {},
			status: "init",
			turnPlayer: "",
			turnCount: 0,
			turnPhase: "setup",
			endResult: null,
			eventQueue: [],
			resolvedEventQueue: [],
			attackCount: {},
			resolvingTriggerAbility: false
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

	/**
	 * Push event immediately
	 * @param state 
	 * @param event 
	 * @returns 
	 */
	export async function pushEvent<Event extends GameEvent>(state: GameState, event: Event): Promise<Event> {
		let promise: Promise<Event> = new Promise((resolvePromise, rejectPromise) => {
			state.eventQueue.push({
				event: event,
				resolve() {
					resolvePromise(event)
				},
				reject() {
					rejectPromise(event)
				},
				resolved: false
			})
		});
		return promise;
	}

	export function updateCards(state: GameState, context: GameEventContext, cards: Array<Card>) {
		for (let card of cards) {
			state.cards[card.id] = card;
		}
		pushEvent(state, { id: newUUID(state), type: "update_card", cards: cards, context: context })
	}


	export function isAbilityUseable(state: GameState, player: string, effect: CardEffectInstance): boolean {
		let activateCtx: CardEffectContext = { state: state, player: player, card: effect.card };
		return CardEffectInstance.canUse(effect) && Card.canPosibblyActivateEffect(effect.card) && effect.effect.type === "activate" && CardEffectInstance.checkCondition(effect, activateCtx);
	}

	export function hasUseableActivateAbility(state: GameState, card: Card): boolean {
		return state.effects[card.id].some(e => isAbilityUseable(state, Card.getOwner(card), e));
	}
	
	export async function activateAbility(state: GameState, context: GameEventContext, card: Card): Promise<void> {
		let firstUseableEffect = state.effects[card.id].find(e => isAbilityUseable(state, context.player || "", e));
		if (!firstUseableEffect) {
			return;
		}

		await resolveAbility(state, context, firstUseableEffect!);
	}


	export async function resolveAbility(state: GameState, context: GameEventContext, effect: CardEffectInstance, event?: GameEvent): Promise<void> {
		let card = effect.card;
		let playerId = card.owner;
		let ctx: CardEffectContext = {
			state: state, card: card, player: playerId, event: event
		};
		
		let activateEvent = await pushEvent(state, { 
			id: Match.newUUID(state), 
			type: "activate", 
			card: card, 
			context: context
		});
		activateEvent.context.reason |= EventReason.ACTIVATE

		await effect.effect.activate(ctx);

		// discard if is action or trigger activated from hand
		if (Card.hasType(card, CardType.ACTION | CardType.TRIGGER) && Card.hasLocation(card, CardLocation.HAND)) {
			Match.discard(state, context, [card]);
		}

		CardEffectInstance.setLimitReached(effect, CardEffectUseLimit.ONCE_PER_TURN);
	}
	export async function damage(state: GameState, context: GameEventContext, cards: Array<Card>, amount: number): Promise<number> {
		if (amount <= 0) return 0;
		let damageEvent: GameEvent = {
			id: newUUID(state),
			type: "damage",
			context: context,
			cards: cards,
			amount: amount
		}
		let event = await pushEvent(state, damageEvent);
		event.context.reason |= EventReason.DAMAGED

		for (let card of event.cards) {
			if (!Card.hasLocation(card, CardLocation.ON_FIELD) || !Card.hasType(card, CardType.DISH)) {
				continue;
			}
			card.damage += event.amount;
			let damagedBuff: CardBuff = {
				id: BUFF_ID_DAMAGED,
				sourceCard: null,
				type: "health",
				operation: "add",
				amount: -event.amount,
				resets: CardBuffResetFlag.TARGET_REMOVED
			};
			addBuff(state, event.context, [card], damagedBuff);
		}

		destroy(state, context, cards.filter(c => Card.getHealth(c) <= 0));

		updateCards(state, context, event.cards);
		return event.amount;

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

	export function setHP(state: GameState, playerId: string, hp: number): void {
		let player = getPlayer(state, playerId);
		player.hp = hp > 0 ? hp : 0;
		//pushEvent(state, { id: newUUID(state), type: "update_hp", sourcePlayer: reasonPlayer, player: playerId, reason: reason, amount: hp })
	}

	export async function healPlayer(state: GameState, context: GameEventContext, playerId: string, amount: number): Promise<number> {
		let healEvent: GameEvent = {
			id: newUUID(state), 
			type: "update_hp", 
			context: context,
			player: playerId, 
			amount: amount
		};

		healEvent = await pushEvent(state, healEvent);
		setHP(state, healEvent.player, getHP(state, healEvent.player) + healEvent.amount);
		return healEvent.amount;

	}
	
	export async function damagePlayer(state: GameState, context: GameEventContext, playerId: string, amount: number): Promise<number> {
		let hurtEvent: GameEvent = {
			id: newUUID(state), 
			type: "update_hp", 
			context: context,
			player: playerId, 
			amount: -amount
		};

		hurtEvent = await pushEvent(state, hurtEvent);
		setHP(state, hurtEvent.player, getHP(state, hurtEvent.player) + hurtEvent.amount);
		if (getHP(state, hurtEvent.player) <= 0) {
			makePlayerLose(state, hurtEvent.player, EndResultStringKeys.HP_REACHES_ZERO);
		}
		return hurtEvent.amount;
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

	export function moveCardToZone(state: GameState, context: GameEventContext, cards: Array<Card>, zone: CardZone, insertLocation: "top" | "bottom") {
		let movedCard: Array<Card> = [];
		insertLocation = insertLocation || "top";
		// remove each card from their previous zone
		cards.forEach(card => {
			let oldLocation = Card.getLocation(card);
			let oldZone = findZones(state, oldLocation, Card.getOwner(card), Card.getColumn(card))
			if (oldZone.length > 0) {
				oldZone[0].cards = oldZone[0].cards.filter(cardInZone => cardInZone !== card.id);
			}
			
			// card left the field
			if (BitField.any(oldLocation, CardLocation.ON_FIELD) && !BitField.any(zone.location, CardLocation.ON_FIELD)) {
				Card.resetProperties(card);
				// remove its buff
				removeBuffs(state, context, [card], buff => BitField.any(buff.resets, CardBuffResetFlag.TARGET_REMOVED));
				// remove buffs that depends on this card being on the field
				removeBuffs(state, context, getCards(state, CardLocation.ON_FIELD), buff => buff.sourceCard === card && BitField.any(buff.resets, CardBuffResetFlag.SOURCE_REMOVED));
				// reset effect limit
				for (let effect of state.effects[card.id]) {
					CardEffectInstance.restoreAllLimits(effect);
				}
			
			}
		
		});

		cards.forEach((card) => {
			card.location = zone.location
			card.column = zone.column
		});

		let insertStartIndex: number = 0;
		// place a card in the new zone
		switch (insertLocation) {
			case "top":
				insertStartIndex = zone.cards.length
				zone.cards = zone.cards.concat(cards.map(c => c.id));
				movedCard = movedCard.concat(cards);
				break;
			case "bottom":
				insertStartIndex = 0
				zone.cards = cards.map(c => c.id).concat(zone.cards);
				movedCard = movedCard.concat(findCardsById(state, zone.cards));
				break;
		}

		movedCard.forEach((card, index) => {
			card.sequence = index + insertStartIndex;
		});

		updateCards(state, context, movedCard)

		//const getLocations = (_cards: Array<Card>) => _cards.map(c => c.location + "").reduce((a,b) => a + " " + b, "")
		// print card location list acquired from parameters: location updated correctly 
		//state.log?.debug("card locations from parameters: " + getLocations(cards))
		// print card location list from card data from game state registry: location somehow did not get updated >:/
		//state.log?.debug("card locations from game states: " + getLocations(findCardsById(state, cards.map(c => c.id))))
	}

	export async function shuffle(state: GameState, context: GameEventContext, owner: string, location: CardLocation, column: number): Promise<void> {
		let zones = findZones(state, location, owner, column);
		if (zones.length > 0) {
			let zone = zones[0];
			let event = await pushEvent(state, {
				id: newUUID(state),
				type: "shuffle",
				context: context,
				player: owner,
				location: location,
				column: column,
				sequences: ArrayUtil.shuffle(ArrayUtil.range(0, zone.cards.length))
			});
			zone.cards = event.sequences.map(idx => zone.cards[idx]);
			let shuffledCards = findCardsById(state, zone.cards);
			shuffledCards.forEach((card, index) => {
				card.sequence = index;
			})
			updateCards(state, context, shuffledCards);
		}
	}

	export async function moveCard(state: GameState, context: GameEventContext, cards: Array<Card>, targetLocation: CardLocation, targetPlayerId: string, column: number | null, placement: "top" | "bottom" | "shuffle"): Promise<void> {
		let shuffleCards: boolean = false
		if (placement === "shuffle") {
			placement = "top";
			shuffleCards = true;
		}

		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "move_card",
			context: context,
			cards: cards,
			location: targetLocation,
			column: column || 0,
			player: targetPlayerId,
			placement: placement
		});

		let targetZones = findZones(state, event.location, event.player, event.column);
		if (targetZones.length > 0) {
			let targetZone = targetZones[0];
			moveCardToZone(state, context, event.cards, targetZone, event.placement);
			if (shuffleCards) {
				await shuffle(state, context, event.player, event.location, event.column);
			}
			//updateCards(state, event.cards, reason, player);
		}
	}

	export function makePlayerLose(state: GameState, playerId: string, reason: string) {
		if (state.endResult) {
			state.endResult.winners = state.endResult.winners.filter(p => p !== playerId);
		}
		else {
			end(state, {
				winners: getActivePlayers(state).filter(p => p !== playerId),
				reason: reason
			})
		}
	}
	
	export async function recycle(state: GameState, context: GameEventContext, cards: Array<Card>, placement: "top" | "bottom" | "shuffle"): Promise<void> {
		if (cards.length === 0) return;
		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "recycle",
			context: context,
			cards: cards
		});
		event.context.reason |= EventReason.RECYCLED
		let locationGroup = ArrayUtil.group(event.cards, card => Card.hasType(card, CardType.DISH) ? CardLocation.RECIPE_DECK : CardLocation.MAIN_DECK);
		for (let { key, items } of locationGroup) {
			let location = key
			let ownerGroup = ArrayUtil.group(items, Card.getOwner)
			for (let { key, items } of ownerGroup) {
				let owner = key
				await moveCard(state, context, items, location, owner, 0, placement);
			}
		}
	}

	export async function discard(state: GameState, context: GameEventContext, cards: Array<Card>): Promise<void> {
		if (cards.length === 0) return;
		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "discard",
			context: context,
			cards: cards
		});
		event.context.reason |= EventReason.DISCARDED
		let ownerGroup = ArrayUtil.group(event.cards, Card.getOwner)
		for (let { key, items } of ownerGroup) {
			let owner = key
			await moveCard(state, event.context, items, CardLocation.TRASH, owner, 0, "top");
		}
	}	
	
	export async function destroy(state: GameState, context: GameEventContext, cards: Array<Card>): Promise<void> {
		if (cards.length === 0) return;
		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "destroy",
			context: context,
			cards: cards
		});
		event.context.reason |= EventReason.DESTROYED
		let cardGroup = ArrayUtil.group(event.cards, Card.getOwner);
		for (let { key, items} of cardGroup) {
			await moveCard(state, event.context, items, CardLocation.TRASH, key, 0, "top");
		}
	}

	export async function setToStandby(state: GameState, context: GameEventContext, card: Card, playerId: string, column: number): Promise<void> {
		let event = await pushEvent(state, { 
			id: newUUID(state), 
			type: "set", 
			context: context,
			card: card, 
			player: playerId,
			column: column 
		});
		event.context.reason |= EventReason.SET
		let zone = getPlayer(state, playerId).standbyZone[event.column];
		if (!zone) {
			return;
		}
		await moveCard(state, event.context, [event.card], CardLocation.STANDBY_ZONE, event.player, event.column, "top");
		updateCards(state, event.context, [event.card]);
	}

	export async function summon(state: GameState, context: GameEventContext, card: Card, playerId: string, column: number, isQuickSet: boolean = false): Promise<void> {
		let location = isQuickSet ? CardLocation.STANDBY_ZONE : CardLocation.SERVE_ZONE;
		let event = await pushEvent(state, { 
			id: newUUID(state), 
			context: context,
			type: "summon", 
			card: card, 
			player: playerId,
			column: column,
			quickSet: isQuickSet
		});
		event.context.reason |= EventReason.SUMMON
		await moveCard(state, event.context, [event.card], location, event.player, event.column, "top");

		// allow attack on owner turn and turn 2 or onward only
		if (Match.isPlayerTurn(state, Card.getOwner(event.card)) && state.turnCount > 1) {
			resetCardAttackCount(state, event.card);
		}

		updateCards(state, event.context, [event.card]);

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
	}

	export function findCardsById(state: GameState, ids: Array<CardID>): Array<Card> {
		return ids.map(id => findCardByID(state, id)).filter(card => card !== null).map(card => card!);
	}

	export function getTopCards(state: GameState, count: number, location: CardLocation, ownerId: string, column?: number): Array<Card> {
		let cards = getCards(state, location, ownerId, column);
		count = Math.min(count, cards.length);
		return cards.slice(-count);
	}

	export async function addToHand(state: GameState, context: GameEventContext, cards: Array<Card>): Promise<number> {
		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "add_to_hand",
			context: context,
			cards: cards
		})
		let ownerGroup = ArrayUtil.group(event.cards, Card.getOwner)
		await Promise.all(ownerGroup.map(({ key, items }) => {
			return moveCard(state, event.context, items, CardLocation.HAND, key, 0, "top");
		}));

		//updateCards(state, event.cards, reason, playerId);
		return cards.length;
	}

	export async function drawCard(state: GameState, context: GameEventContext, playerId: string, count: number): Promise<number> {
		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "draw",
			context: context,
			player: playerId,
			count: count
		})
		event.context.reason |= EventReason.DRAW

		let drewCards = getTopCards(state, event.count, CardLocation.MAIN_DECK, event.player);
		let drewCount = drewCards.length;

		// Decked out if requested top card has less card than the required count
		if (drewCount < count) {
			end(state, {
				winners: Match.getActivePlayers(state).filter(otherPlayerId => otherPlayerId !== playerId),
				reason: EndResultStringKeys.DECKED_OUT
			});
			return 0;
		}

		return await addToHand(state, event.context, drewCards);
	}

	export async function fillHand(state: GameState, context: GameEventContext, playerId: string, size: number, min: number): Promise<number> {
		// Draw until player has a fixed number of cards in their hand, capped at minimum by min.
		let handSize = getPlayer(state, playerId).hand.cards.length;
		let drawSize = Math.max(size - handSize, min);
		return await drawCard(state, context, playerId, drawSize);
	}

	export async function goToSetupPhase(state: GameState, context: GameEventContext): Promise<void> {
		let changePhaseEvent: GameEvent = { 
			id: newUUID(state), 
			context: context,
			type: "change_phase", 
			phase: "setup"
		};
		changePhaseEvent = await pushEvent(state, changePhaseEvent);
		state.turnPhase = changePhaseEvent.phase;
	}

	export async function goToStrikePhase(state: GameState, context: GameEventContext): Promise<void> {
		let changePhaseEvent: GameEvent = { 
			id: newUUID(state), 
			context: context,
			type: "change_phase", 
			phase: "strike"
		};
		changePhaseEvent = await pushEvent(state, changePhaseEvent);
		state.turnPhase = changePhaseEvent.phase;
	}

	export async function gotoNextTurn(state: GameState, context: GameEventContext): Promise<void> {
		let event = await pushEvent(state, { 
			id: newUUID(state), 
			context: context,
			type: "change_turn", 
			turn: state.turnCount + 1, 
			turnPlayer: getOpponent(state, getTurnPlayer(state))
		});

		await endTurn(state, event.context);
		state.turnCount = event.turn;
		state.turnPlayer = event.turnPlayer;
		await beginTurn(state, event.context);
		
	}

	export async function endTurn(state: GameState, context: GameEventContext): Promise<void> {
		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "end_turn",
			context: context,
			turnPlayer: getTurnPlayer(state)
		});

		removeBuffs(state, event.context, getCards(state, CardLocation.ON_FIELD), (buff) => BitField.any(buff.resets, CardBuffResetFlag.END_TURN));
		for (let cardId in state.effects) {
			for (let effect of state.effects[cardId]) {
				CardEffectInstance.restoreLimit(effect, CardEffectUseLimit.ONCE_PER_TURN);
			}
		}
	}

	export async function beginTurn(state: GameState, context: GameEventContext): Promise<void> {
		let event = await pushEvent(state, {
			id: newUUID(state),
			type: "begin_turn",
			context: context,
			turnPlayer: getTurnPlayer(state)
		});

		let turnPlayer = event.turnPlayer;

		// reset timer
		let maxTimeout = GameConfiguration.timeout.fixed + GameConfiguration.timeout.byTurn
		state.players[turnPlayer]!.timeout = Math.min(maxTimeout, (state.players[turnPlayer]!.timeout - GameConfiguration.timeout.fixed) + GameConfiguration.timeout.byTurn);

		await goToSetupPhase(state, event.context);
		await fillHand(state, event.context, turnPlayer, GameConfiguration.drawSizePerTurns, 1);
		resetPlayerCardAttackCount(state, event.context, turnPlayer);
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
		return (state.endResult ? state.endResult.reason : EndResultStringKeys.GENERIC);
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

		return hasUseableActivateAbility(state, card);
	}

	export function resetPlayerCardAttackCount(state: GameState, context: GameEventContext, playerId: string) {
		let cardsToBeReset = getCards(state, CardLocation.SERVE_ZONE, playerId);
		cardsToBeReset.forEach(card => {
			resetCardAttackCount(state, card);
		});
		updateCards(state, context, cardsToBeReset);
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

	export function negateAttack(state: GameState, card: Card): void {
		for (let event of state.eventQueue) {
			if (event.event.type === "attack" && event.event.attackingCard.id === card.id) {
				event.event.canceled = true;
			}
		}
	}

	export async function battle(state: GameState, context: GameEventContext, attackingCard: Card, targetCard: Card): Promise<void> {
		if (!isCardCanAttack(state, attackingCard)) {
			return;
		}
		
		let declareAttackEvent: GameEvent & { type: "declare_attack" } = { 
			id: newUUID(state), 
			type: "declare_attack",
			context: context,
			attackingCard: attackingCard, 
			isDirect: false, 
			targetCard: targetCard,
			negated: false
		};
		declareAttackEvent = await pushEvent(state, declareAttackEvent);
		
		let attackEvent: GameEvent = {
			id: newUUID(state),
			type: "attack",
			context: declareAttackEvent.context,
			attackingCard: declareAttackEvent.attackingCard,
			isDirect: false,
			targetCard: declareAttackEvent.targetCard
		};
		attackEvent = await pushEvent(state, attackEvent);
		attackEvent.context.reason |= EventReason.BATTLE

		if (isCardCanAttack(state, attackEvent.attackingCard)) {
			let targetPower = Card.getPower(attackEvent.targetCard);
			let attackerPower = Card.getPower(attackEvent.attackingCard);
			damage(state, attackEvent.context, [attackEvent.attackingCard], targetPower);
			damage(state, attackEvent.context, [attackEvent.targetCard], attackerPower);				
		}
		removeCardAttackCount(state, attackingCard);

	}

	export async function attackPlayer(state: GameState, context: GameEventContext, attackingCard: Card, targetPlayerId: string): Promise<void> {
		if (!isCardCanAttack(state, attackingCard)) {
			return;
		}

		let attackDeclareEvent: GameEvent & { type: "declare_attack" } = { 
			id: newUUID(state), 
			type: "declare_attack",
			context: context,
			attackingCard: attackingCard, 
			isDirect: true, 
			targetPlayer: targetPlayerId,
			negated: false
		};
		attackDeclareEvent = await pushEvent(state, attackDeclareEvent);

		let attackEvent: GameEvent = {
			id: newUUID(state),
			type: "attack",
			context: attackDeclareEvent.context,
			attackingCard: attackDeclareEvent.attackingCard,
			isDirect: true,
			targetPlayer: attackDeclareEvent.targetPlayer
		};
		attackEvent = await pushEvent(state, attackEvent);
		attackEvent.context.reason |= EventReason.BATTLE

		if (isCardCanAttack(state, attackEvent.attackingCard)) {
			let attackerPower = Card.getPower(attackEvent.attackingCard);
			Match.damagePlayer(state, attackEvent.context, attackEvent.targetPlayer, attackerPower);			
		}
		removeCardAttackCount(state, attackingCard);
		
	}

	export function isSetupPhase(state: GameState): boolean {
		return state.turnPhase === "setup"
	}

	export function isStrikePhase(state: GameState): boolean {
		return state.turnPhase === "strike"
	}

	export function addBuff(state: GameState, context: GameEventContext, cards: Array<Card>, buff: CardBuff) {
		for (let card of cards) {
			state.buffs[card.id] = state.buffs[card.id].concat(buff)
			//state.log?.debug("addBuff: buffs: %s", JSON.stringify(state.buffs[card.id]))
			//state.log?.debug("addBuff: buffs: %s", JSON.stringify(getBuffs(state, card)))
			reapplyBuffs(state, card);
		}
		updateCards(state, context, cards);
	}

	export function getBuffs(state: GameState, card: Card): Array<CardBuff> {
		return state.buffs[card.id];
	}

	export function removeBuffs(state: GameState, context: GameEventContext, cards: Array<Card>, condition: (buff: CardBuff) => boolean) {
		for (let card of cards) {
			state.buffs[card.id] = state.buffs[card.id].filter(buff => !condition(buff));
			reapplyBuffs(state, card);
		}
		updateCards(state, context, cards);
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

	export async function dispatchPlayerRequest<T extends PlayerChoiceType>(state: GameState, playerId: string, request: PlayerChoiceRequest & {type: T}): Promise<PlayerChoiceResponseValue<T>> {
		/*
		let requestEvent: GameEvent = { 
			id: newUUID(state), 
			type: "request_choice", 
			sourcePlayer: playerId, 
			reason: EventReason.UNSPECIFIED,
			request: request,
		};
		pushEvent(state, requestEvent).then((event) => {
			state.currentChoiceRequest = event.request;
		})
		*/
		return new Promise((resolve, reject) => {
			state.activeRequest = {
				request: request,
				response: null,
				dispatched: false
			};
		})

	}

	export function dispatchPlayerResponse(state: GameState, playerId: string, response: PlayerChoiceResponse): void {
		if (!state.activeRequest || state.activeRequest.request.type !== response.type) {
			return;
		}		
		state.activeRequest.response = response;
	}

	export function clearPlayerRequest(state: GameState): void {
		state.activeRequest = undefined;
	}

	export async function makePlayerSelectCards(state: GameState, playerId: string, cards: Array<Card>, min: number, max: number = min): Promise<Array<Card>> {
		let hintMsg = popSelectionHint(state);
		return new Promise((resolve) => {
			let newRequest: PlayerChoiceRequest = {
				type: "cards",
				playerId: playerId,
				hint: hintMsg,
				min: min,
				max: max,
				cards: cards,
				callback: (selectedCards: Array<Card>) => {
					let response: PlayerChoiceResponse = {
						type: "cards",
						playerId: playerId,
						hint: hintMsg,
						choice: selectedCards
					};
					dispatchPlayerResponse(state, playerId, response);
					resolve(selectedCards);
				}
			};
			dispatchPlayerRequest(state, playerId, newRequest);
		});
	}

	export async function makePlayerSelectFreeZone(state: GameState, playerId: string, location: number, ownerId: string = playerId): Promise<CardZone | undefined> {
		let zones = findZones(state, location, ownerId).filter(zone => zone.cards.length === 0);
		let hintMsg = popSelectionHint(state);
		const selectAmount = 1;
		if (zones.length <= 0) {
			return undefined;
		}
		return new Promise((resolve) => {
			let newRequest: PlayerChoiceRequest = {
				type: "zones",
				playerId: playerId,
				hint: hintMsg,
				min: selectAmount,
				max: selectAmount,
				zones: zones,
				callback: (selectedZones: Array<CardZone>) => {
					let selectedZone = selectedZones[0];
					let response: PlayerChoiceResponse = {
						type: "zones",
						playerId: playerId,
						hint: hintMsg,
						choice: [ selectedZone ]
					};
					dispatchPlayerResponse(state, playerId, response);
					resolve(selectedZone);
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
			let newRequest: PlayerChoiceRequest = {
				type: "yes_no",
				hint: hintMsg,
				playerId: playerId,
				callback: (choice: boolean) => {
					let response: PlayerChoiceResponse = {
						type: "yes_no",
						playerId: playerId,
						hint: hintMsg,
						choice: choice
					};
					dispatchPlayerResponse(state, playerId, response);
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
			let newRequest: PlayerChoiceRequest = {
				type: "option",
				hint: hintMsg,
				playerId: playerId,
				options: options,
				callback: (choice: number) => {
					let response: PlayerChoiceResponse = {
						type: "option",
						playerId: playerId,
						hint: hintMsg,
						choice: choice
					};
					dispatchPlayerResponse(state, playerId, response);
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

	function getUseableResponseTriggerAbilities(state: GameState, events: Array<GameEvent>, resolutionPhase: "before" | "after"): Array<{ event: GameEvent, effect: CardEffectInstance }> {
		let applicableTriggerEffects = Object.values(state.effects).flat(1).map((e) => {
			if (e.effect.type === "trigger" && e.effect.resolutionPhase === resolutionPhase) {
				for (let event of events) {
					if (isTriggerAbilityUseable(state, e.card.owner, e, event)) {
						return { event: event, effect: e };
					}
				}
			}
			return null;
		}).filter((e): e is NonNullable<typeof e> => e !== null);
		return applicableTriggerEffects;
	}

	export async function makePlayersSelectResponseTriggerAbility(state: GameState, events: Array<GameEvent>, resolutionPhase: "before" | "after"): Promise<boolean> {
		let applicableTriggerEffects = getUseableResponseTriggerAbilities(state, events, resolutionPhase);
		
		let triggerEffectsGroupedByOwner = ArrayUtil.group(applicableTriggerEffects, e => Card.getOwner(e.effect.card));
		// prioritize opponent before turn player
		let turnPlayer = getTurnPlayer(state);
		let firstPlayer = getOpponent(state, turnPlayer);
		let secondPlayer = turnPlayer;

		for (let { key, items} of triggerEffectsGroupedByOwner) {
			let player = key
			let playerEffects = items;
			if (playerEffects && playerEffects.length > 0) {
				setSelectionHint(state, "HINT_ACTIVATE_TRIGGER");
				let selected = await makePlayerSelectCards(state, player, playerEffects.map(e => e.effect.card), 0, 1);
				// activate effect if any is selected
				if (selected.length > 0) {
					//state.resolvingTriggerAbility = true;
					let triggeringCard = selected[0];
					let triggeringAbilityEntry = playerEffects.find(e => e.effect.card.id === triggeringCard.id);
					if (triggeringAbilityEntry) {
						// push activation to activate it BEFORE processing event in the next tick
						//state.pendingTriggerActivations.push({
						//	effect: triggeringAbilityEntry.effect,
						//	event: triggeringAbilityEntry.event
						//});
						let activateContext: GameEventContext = { 
							reason: EventReason.ACTIVATE,
							player: player
						}
						await resolveAbility(state, activateContext, triggeringAbilityEntry.effect, triggeringAbilityEntry.event);
						//state.resolvingTriggerAbility = false;
						// skip any remaining to restrict one trigger effect on any action at the time
						return true;
					}
				}
			}			
		}
		return false;
	}

	export function isWaitingPlayerChoice(state: GameState, playerId?: string): boolean {
		return !!state.currentCardRequest && (!playerId || state.currentCardRequest.playerId === playerId);
	}
}