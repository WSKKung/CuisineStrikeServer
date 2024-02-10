import { Card } from "./model/cards";


export type GameEvent = {
	id: string
	sourcePlayer: string
	canceled?: boolean
	reason: number
} & (
		{
			type: "change_turn"
			turn: number
			turnPlayer: string
		} |
		{
			type: "change_phase"
			phase: "setup" | "strike"
		} |
		{
			type: "to_hand"
			cards: Array<Card>
		} |
		{
			type: "discard"
			cards: Array<Card>
		} |
		{
			type: "set"
			card: Card
			column: number
		} |
		{
			type: "summon"
			card: Card
			column: number
		} |
		({
			type: "attack"
			attackingCard: Card
		} & (
				{
					directAttack: true
					targetPlayer: string
				} |
				{
					directAttack: false
					targetCard: Card
				})) |
		{
			type: "destroy"
			cards: Array<Card>
		} |
		{
			type: "damage"
			player: string
			amount: number
		} |
		{
			type: "update_card"
			cards: Array<Card>
			reason: EventReason
		} |
		{
			type: "update_hp"
			player: string
		} |
		{
			type: "activate"
			player: string
			card: Card
		} |
		{
			type: "request_card_choice"
			player: string
			cards: Array<Card>
			min: number
			max: number
			hint: string
		})

export enum EventReason {
	UNSPECIFIED = 0,
	GAMERULE = 0x1,
	EFFECT = 0x2,
	COST = 0x4,
	DESTROYED = 0x8,
	SUMMON = 0x10,
	BATTLE = 0x20,
	DRAW = 0x40,
	SET = 0x80,
	ACTIVATE = 0x100,
	DAMAGED = 0x200
}
