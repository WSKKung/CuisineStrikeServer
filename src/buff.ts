import { Card } from "./model/cards";
import { GameState } from "./match";

export const BUFF_ID_DAMAGED = "70eaccf6-b641-47c6-af7e-dce170fa4284";
export const BUFF_ID_OVERGRADED = "cccf2024-d7d2-408a-a608-0eb3d70165e1";

export type CardBuff = {
	id: string,
	sourceCard: Card | null,
	resets: number,
} & (
	{
		type: "power" | "health" | "grade" | "shield",
		operation: CardBuffOperation,
		amount: number | CardBuffAmountFunction
	}
)

export type CardBuffApplyContext = { state: GameState, card: Card }
export type CardBuffAmountFunction = (context: CardBuffApplyContext) => number

export type CardBuffOperation = "add" | "multiply" | CardBuffOperationFunction
export type CardBuffOperationFunction = (base: number, amount: number) => number

export type CardBuffType = CardBuff["type"]

export enum CardBuffResetCondition {
	NONE = 0b0,
	END_TURN = 0b1,
	SOURCE_REMOVED = 0b10, // reset when buff source has moved outside the field
	TARGET_REMOVED = 0b100, // reset when buff target has moved outside the field
}

export namespace CardBuff {
	export function getOperation(buff: CardBuff): CardBuffOperationFunction {
		switch (buff.operation) {
			case "add":
				return (base, amount) => base + amount;
			case "multiply":
				return (base, amount) => base * amount;
			default:
				return buff.operation;
		}
	}

	export function getAmount(context: CardBuffApplyContext, buff: CardBuff): number {
		if (typeof(buff.amount) === "number") {
			return buff.amount;
		}
		return buff.amount(context);
	}

	function getBuffTargetGetterSetter(buff: CardBuff): { get: (card: Card) => number, set: (card: Card, value: number) => void } {
		switch (buff.type) {
			case "power":
				return { get: Card.getPower, set: Card.setPower }
			case "health":
				return { get: Card.getHealth, set: Card.setHealth }
			case "grade":
				return { get: Card.getGrade, set: Card.setGrade }
			default:
				return { get: () => 0, set: () => {}}
		}
	}

	export function applyToCard(state: GameState, card: Card, buff: CardBuff) {
		let ctx: CardBuffApplyContext = { state, card }
		let op = getOperation(buff);
		let amount = getAmount(ctx, buff);
		let { get, set } = getBuffTargetGetterSetter(buff);
		set(card, op(get(card), amount))
	}
}