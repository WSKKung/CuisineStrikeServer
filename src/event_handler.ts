import { number } from "zod"
import { GameEventListener, GameEventType, createGameEventListener } from "./event_queue"
import { GameEvent } from "./model/events"
import { GameState, Match } from "./match"
import { GameConfiguration } from "./constants"
import { Card, CardLocation } from "./model/cards"

export type GameEventHandler = {
	addListener<T extends GameEventType>(listener: GameEventListener<T>): void,
	handle(event: GameEvent, state: GameState): void
}

export function setupBaseMechanicsEventHandler(eventHandler: GameEventHandler): GameEventHandler {
	// Battle
	return eventHandler;
}

export function createEventHandler(): GameEventHandler {
	const listeners: {[type in GameEventType]?: Array<GameEventListener<type>>} = {};
	return {
		
		addListener(listener) {
			if (!listeners[listener.type]) {
				listeners[listener.type] = [];
			}
			listeners[listener.type]?.push(listener);
		},

		handle(event, state) {
			if (listeners[event.type]) {
				let listenersForCurrentEvent: Array<GameEventListener<typeof event.type>> = listeners[event.type]!;
				for (let listener of listenersForCurrentEvent) {
					if (event.canceled) break;
					let context = { gameState: state };
					listener.on(event, context);
				}
			}	
		}

	};
}