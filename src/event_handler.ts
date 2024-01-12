import { number } from "zod"
import { GameEvent, GameEventListener, GameEventType, createGameEventListener } from "./event_queue"
import { GameState, Match } from "./match"
import { GameConfiguration } from "./constants"
import { Card, CardLocation } from "./card"

export type GameEventHandler = {
	addListener<T extends GameEventType>(listener: GameEventListener<T>): void,
	handle(event: GameEvent, state: GameState): void
}

export function setupBaseMechanicsEventHandler(eventHandler: GameEventHandler): GameEventHandler {
	// Draw on start turn
	eventHandler.addListener(createGameEventListener("change_turn", (event, context) => {
		let turnPlayer = Match.getTurnPlayer(context.gameState);
		Match.fillHand(context.gameState, turnPlayer, GameConfiguration.drawSizePerTurns, 1);
		Match.resetPlayerCardAttackCount(context.gameState, turnPlayer);
	}));


	// attack
	eventHandler.addListener(createGameEventListener("attack", (event, { gameState }) => {
		if (event.canceled) return;

		let attacker: Card = Match.findCardByID(gameState, event.attackingCard)!;
		let attackerPower = Card.getPower(attacker);

		Match.removeCardAttackCount(gameState, attacker);

		if (event.directAttack) {
			Match.setHP(gameState, event.targetPlayer, Match.getHP(gameState, event.targetPlayer) - attackerPower, "battle", event.sourcePlayer);
			return;
		}

		let attackTarget: Card = Match.findCardByID(gameState, event.targetCard)!;
		let targetPower = Card.getPower(attackTarget);

		Match.damage(gameState, [attacker], targetPower, "battle", event.sourcePlayer);
		Match.damage(gameState, [attackTarget], attackerPower, "battle", event.sourcePlayer);
	}));

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