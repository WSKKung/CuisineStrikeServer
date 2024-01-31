import { Card } from "./card";

export const BUFF_ID_DAMAGED = "70eaccf6-b641-47c6-af7e-dce170fa4284";
export const BUFF_ID_OVERGRADED = "cccf2024-d7d2-408a-a608-0eb3d70165e1";

export type CardBuff = {
	id: string,
	sourceCard: Card | null,
	resets: number,
} & (
	{
		type: "power" | "health" | "grade",
		operation: "add" | "multiply",
		amount: number
	}
)

export type CardBuffType = CardBuff["type"]

export enum CardBuffResetCondition {
	NONE = 0b0,
	END_TURN = 0b1,
	SOURCE_REMOVED = 0b10, // reset when buff source has moved outside the field
	TARGET_REMOVED = 0b100, // reset when buff target has moved outside the field
}