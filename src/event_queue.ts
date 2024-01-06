import { CardID } from "./card"
import { GameState } from "./match"

export type GameEvent = {
	id: string,
	sourcePlayer: string
} & (
	{
		type: "change_turn",
		turn: number,
		turnPlayer: string
	} |
	{
		type: "to_hand",
		cards: Array<CardID>
	} |
	{
		type: "discard",
		cards: Array<CardID>
	} |
	{
		type: "set",
		card: CardID,
		column: number
	} |
	{
		type: "summon",
		card: CardID,
		column: number
	} |
	{
		type: "attack",
		attackingCard: CardID,
		targetCard: CardID
	} |
	{
		type: "destroy",
		cards: Array<CardID>
	} |
	{
		type: "damage",
		player: string,
		amount: number
	}
)

export type GameEventType = GameEvent["type"]

export type GameEventListener<T extends GameEventType> = {
	type: T,
	on(event: GameEvent & { type: T }, context: { gameState: GameState }): void
}

export function createGameEventListener<T extends GameEventType>(eventType: T, callbackFunc: GameEventListener<T>["on"]): GameEventListener<T> {
	return {
		type: eventType,
		on: callbackFunc
	}
}
