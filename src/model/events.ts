import { CardZone } from "./field";
import { Card, CardLocation } from "./cards";
import { PlayerChoiceRequest, PlayerChoiceResponse } from "./player_request";

export type GameEventContext = {
	player: string | null
	reason: number
}

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
	GameEventAddCardToHand |
	GameEventMoveCard |
	GameEventShuffle |
	GameEventTurnBegin |
	GameEventTurnEnd

export type GameBaseEvent = {
	id: string
	type: string
	context: GameEventContext
	canceled?: boolean
	responded?: boolean
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
	player: string
	card: Card
	column: number
}

export type GameEventSummonCard = GameBaseEvent & {
	type: "summon"
	player: string
	card: Card
	column: number
	quickSet: boolean
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
	negated?: boolean
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
	player: string
	count: number
}

export type GameEventAddCardToHand = GameBaseEvent & {
	type: "add_to_hand"
	cards: Array<Card>
}

export type GameEventRecycleCard = GameBaseEvent & {
	type: "recycle"
	cards: Array<Card>
}

export type GameEventMoveCard = GameBaseEvent & {
	type: "move_card"
	cards: Array<Card>
	player: string
	location: CardLocation
	column: number
	placement: "top" | "bottom"
}

export type GameEventShuffle = GameBaseEvent & {
	type: "shuffle"
	player: string
	location: CardLocation
	column: number
	sequences: Array<number>
}

export type GameEventTurnBegin = GameBaseEvent & {
	type: "begin_turn"
	turnPlayer: string
}

export type GameEventTurnEnd = GameBaseEvent & {
	type: "end_turn"
	turnPlayer: string
}

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
	DAMAGED = 0x200,
	INIT = 0x400,
	RECYCLED = 0x800,
	DISCARDED = 0x1000,
	SURRENDER = 0x2000
}
