import zod, { z } from "zod";
import { GameConfiguration } from "./constants";

export type ActionType = PlayerActionParams["type"]

export type PlayerActionParams = 
	PlayerActionParamsEndTurn |
	PlayerActionParamsToStrikePhase |
	PlayerActionParamsSetIngredient |
	PlayerActionParamsAttack |
	PlayerActionParamsCookSummon |
	PlayerActionParamsAttack | 
	PlayerActionParamsActivate |
	PlayerActionParamsChooseCards | 
	PlayerActionParamsChooseCards |
	PlayerActionParamsChooseZones |
	PlayerActionParamsChooseYesNo |
	PlayerActionParamsChooseOption |
	PlayerActionParamsSurrender |
	PlayerActionParamsReady

export type PlayerActionParamsEndTurn = {
	type: "end_turn"
}

export type PlayerActionParamsToStrikePhase = {
	type: "go_to_strike_phase"
}

export type PlayerActionParamsSetIngredient = {
	type: "set_ingredient",
	card: string,
	column: number,
	materials: Array<string>
}

export type PlayerActionParamsCookSummon = {
	type: "cook_summon",
	card: string,
	column: number,
	materials: Array<string>,
	quick_set?: boolean
}

export type PlayerActionParamsAttack = {
	type: "attack",
	attacking_card: string,
	is_direct: true
} | {
	type: "attack",
	attacking_card: string,
	is_direct?: false,
	target_card: string
}

export type PlayerActionParamsActivate = {
	type: "activate",
	card: string
}

export type PlayerActionParamsChooseCards = {
	type: "choose_cards",
	cards: Array<string>
}

export type PlayerActionParamsChooseZones = {
	type: "choose_zones",
	zones: Array<{ location: number, owner: string, column: number }>
}

export type PlayerActionParamsChooseYesNo = {
	type: "choose_yes_no",
	choice: boolean
}

export type PlayerActionParamsChooseOption = {
	type: "choose_option",
	choice: number
}

export type PlayerActionParamsSurrender = {
	type: "surrender"
}

export type PlayerActionParamsReady = {
	type: "ready",
	ack_time: number
}

const playerActionSchema: {[type in ActionType]: z.ZodSchema<PlayerActionParams & { type: type }>} = {
	end_turn: z.custom<PlayerActionParamsEndTurn>(),
	go_to_strike_phase: z.custom<PlayerActionParamsToStrikePhase>(),
	set_ingredient: z.custom<PlayerActionParamsSetIngredient>(),
	cook_summon: z.custom<PlayerActionParamsCookSummon>(),
	attack: z.custom<PlayerActionParamsAttack>(),
	activate: z.custom<PlayerActionParamsActivate>(),
	choose_cards: z.custom<PlayerActionParamsChooseCards>(),
	choose_zones: z.custom<PlayerActionParamsChooseZones>(),
	choose_yes_no: z.custom<PlayerActionParamsChooseYesNo>(),
	choose_option: z.custom<PlayerActionParamsChooseOption>(),
	surrender: z.custom<PlayerActionParamsSurrender>(),
	ready: z.custom<PlayerActionParamsReady>()
}

export function getPlayerActionSchemaByType<T extends ActionType>(type: T): z.ZodSchema<PlayerActionParams & { type: T }> {
	return playerActionSchema[type];
}

export type SetIngredientActionParams = zod.output<typeof playerActionSchema.set_ingredient>
export type CookSummonActionParams = zod.infer<typeof playerActionSchema.cook_summon>
export type AttackActionParams = zod.infer<typeof playerActionSchema.attack>
export type ActivateActionCardParams = zod.infer<typeof playerActionSchema.activate>
export type ChooseCardsParams = zod.infer<typeof playerActionSchema.choose_cards>
export type ChooseZonesParams = zod.infer<typeof playerActionSchema.choose_zones>
export type ChooseYesNoParams = zod.infer<typeof playerActionSchema.choose_yes_no>
export type ChooseOptionParams = zod.infer<typeof playerActionSchema.choose_option>
export type SurrenderParams = zod.infer<typeof playerActionSchema.surrender>
export type ReadyParams = zod.infer<typeof playerActionSchema.ready>