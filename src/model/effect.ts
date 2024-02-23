import { Card } from "./cards"
import { GameState } from "../match"
import { GameEvent } from "./events"
import { BitField } from "../utility"

export type CardEffect = CardActivateEffect | CardTriggerEffect

export type CardActivateEffect = {
	type: "activate",
	condition: (context: CardEffectContext) => boolean,
	activate: (context: CardEffectContext) => Promise<void>
}

export type CardTriggerEffect = {
	type: "trigger",
	condition: (context: CardEffectContext) => boolean,
	activate: (context: CardEffectContext) => Promise<void>
}

export interface CardEffectContext {
	state: GameState,
	card: Card,
	player: string,
	event?: GameEvent
}

export type TriggerEffectContext = CardEffectContext & {
	event: GameEvent
}

export type CardEffectInstance = {
	effect: CardEffect
	card: Card
	limits: number
	satisfiedLimits: number
}

export namespace CardEffectInstance {

	export function create(effect: CardEffect, card: Card): CardEffectInstance {
		return {
			effect: effect,
			card: card,
			limits: 0,
			satisfiedLimits: 0
		};
	}

	export function setLimitReached(instance: CardEffectInstance, limit: CardEffectUseLimit): void {
		instance.satisfiedLimits = instance.satisfiedLimits | limit;
	}

	export function restoreLimit(instance: CardEffectInstance, limit: CardEffectUseLimit): void {
		instance.satisfiedLimits = instance.satisfiedLimits & (~limit);
	}

	export function restoreAllLimits(instance: CardEffectInstance, ): void {
		instance.satisfiedLimits = 0;
	}

	export function canUse(instance: CardEffectInstance): boolean {
		return !BitField.any(instance.limits, instance.satisfiedLimits);
	}	
	
	export function isType<T extends CardEffect["type"]>(instance: CardEffectInstance, type: T): boolean {
		return instance.effect.type === type;
	}

	export function checkCondition(instance: CardEffectInstance, context: CardEffectContext): boolean {
		return instance.effect.condition(context);
	}

	export function activate(instance: CardEffectInstance, context: CardEffectContext): void {
		instance.effect.activate(context);
	}

}

export enum CardEffectUseLimit {
	NONE = 0,
	ONCE_PER_TURN = 1,
}

export const CardEffectProvider = {

	effects: {} as {[code: number]: Array<CardEffect>},

	register(code: number, effect: CardEffect) {
		if (!this.effects[code]) {
			this.effects[code] = [];
		}
		this.effects[code].push(effect);
	},

	hasEffect(code: number): boolean {
		return !!this.effects[code] && this.effects[code].length > 0;
	},

	getEffect<T extends CardEffect["type"]>(code: number, type: T): Array<CardEffect & { type: T }>
	{
		if (!this.effects[code]) {
			return [];
		}
		return this.effects[code].filter(effect => effect.type === type) as Array<CardEffect & { type: T }>;
	},

	getEffects(code: number): Array<CardEffect>
	{
		if (!this.effects[code]) {
			return [];
		}
		return this.effects[code];
	}
}