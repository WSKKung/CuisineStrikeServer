import { CardZone } from "./field";
import { Card } from "./cards";
import { PlayerChoiceRequest, PlayerChoiceResponse } from "./player_request";

export type GameEvent = GameEventActivateCard |
	GameEventAttack |
	GameEventChangePhase |
	GameEventChangeTurn |
	GameEventDeclareAttack |
	GameEventRequestChoice |
	GameEventSetCard |
	GameEventSummonCard |
	GameEventUpdateCard |
	GameEventChangePlayerHP |
	GameEventUpdatePlayerHP |
	GameEventConfirmChoice |
	GameEventDamageCard |
	GameEventDestroyCard |
	GameEventDiscardCard |
	GameEventRecycleCard |
	GameEventDrawCard |
	GameEventAddCardToHand

export type GameBaseEvent = {
	id: string
	type: string
	reason: number
	sourcePlayer?: string
	canceled?: boolean
}

export type GameEventChangeTurn = GameBaseEvent & {
	type: "change_turn"
	turn: number
	turnPlayer: string
}

export type GameEventChangePhase = GameBaseEvent & {
	type: "change_phase"
	phase: "setup" | "strike"
}

export type GameEventSetCard = GameBaseEvent & {
	type: "set"
	card: Card
	column: number
}

export type GameEventSummonCard = GameBaseEvent & {
	type: "summon"
	card: Card
	column: number
}

export type Attack = {
	attackingCard: Card
	isDirect: true
	targetPlayer: string
} | {
	attackingCard: Card
	isDirect: false
	targetCard: Card
}

export type GameEventDeclareAttack = GameBaseEvent & {
	type: "declare_attack"
	negated: boolean
} & Attack

export type GameEventAttack = GameBaseEvent & {
	type: "attack"
} & Attack

export type GameEventUpdateCard = GameBaseEvent & {
	type: "update_card"
	cards: Array<Card>
}

export type GameEventUpdatePlayerHP = GameBaseEvent &
{
	type: "update_hp"
	player: string
	amount: number
}

export type GameEventActivateCard = GameBaseEvent & {
	type: "activate"
	card: Card
}

export type GameEventRequestChoice = GameBaseEvent & {
	type: "request_choice"
	request: PlayerChoiceRequest
}

export type GameEventConfirmChoice = GameBaseEvent & {
	type: "confirm_choice"
	response: PlayerChoiceResponse
}

export type GameEventChangePlayerHP = GameBaseEvent & {
	type: "damage_player"
	player: string
	amount: number
}

export type GameEventDestroyCard = GameBaseEvent & {
	type: "destroy"
	cards: Array<Card>
}

export type GameEventDiscardCard = GameBaseEvent & {
	type: "discard"
	cards: Array<Card>
}

export type GameEventDamageCard = GameBaseEvent & {
	type: "damage"
	cards: Array<Card>
	amount: number
}

export type GameEventDrawCard = GameBaseEvent & {
	type: "draw"
	count: number
}

export type GameEventAddCardToHand = GameBaseEvent & {
	type: "add_to_hand",
	cards: Array<Card>
}

export type GameEventRecycleCard = GameBaseEvent & {
	type: "recycle"
	cards: Array<Card>
}

export type LGameEvent = {
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
			negated: boolean
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
		} |
		{
			type: "request_zone_choice"
			player: string
			zones: Array<CardZone>
			min: number
			max: number
			hint: string
		} |
		{
			type: "request_yes_no"
			player: string
			hint: string
		} |
		{
			type: "request_option_choice"
			player: string
			options: Array<string>
			hint: string
		}
		)

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
