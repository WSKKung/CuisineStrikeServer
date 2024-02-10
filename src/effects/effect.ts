import { Card } from "../model/cards"
import { GameState } from "../match"

export interface CardEffect {
	type: "active" | "passive"
	condition: CardEffectConditionFunction
	activate: CardEffectActivateFunction
}

export type CardEffectConditionFunction = (context: CardEffectContext) => boolean
export type CardEffectActivateFunction = (context: CardEffectContext) => Promise<void>

export interface CardEffectContext {
	state: GameState,
	card: Card,
	player: string
}

export const CardEffectProvider = {

	effects: {} as {[code: number]: CardEffect},

	register(code: number, effect: CardEffect) {
		this.effects[code] = effect
	},

	hasEffect(code: number): boolean {
		return !!this.effects[code]
	},

	getEffect(code: number): CardEffect | null {
		return this.effects[code] || null
	}
}