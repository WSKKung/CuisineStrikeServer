import { CardID } from "./model/cards"
import { GameEvent } from "./events"
import { GameState } from "./match"

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
