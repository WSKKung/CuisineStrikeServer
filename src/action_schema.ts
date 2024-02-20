import zod, { z } from "zod";
import { GameConfiguration } from "./constants";
import exp from "constants";
import { CardZone } from "./field";

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
	PlayerActionParamsChooseOption

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
	choose_option: z.custom<PlayerActionParamsChooseOption>()
}

export function getPlayerActionSchemaByType<T extends ActionType>(type: T): z.ZodSchema<PlayerActionParams & { type: T }> {
	return playerActionSchema[type];
}

export const actionSchemas = {
	setIngredient: zod.object({
		card: zod.string(),
		column: zod.number().min(0).max(GameConfiguration.boardColumns - 1),
		materials: zod.array(zod.string())
	}),
	
	cookSummon: zod.object({
		card: zod.string(),
		column: zod.number().min(0).max(GameConfiguration.boardColumns - 1),
		materials: zod.array(zod.string()),
		quick_set: zod.boolean().optional()
	}),

	attack: zod.object({
		attacking_card: zod.string(),
		is_direct: zod.boolean(),
		target_card: zod.string().optional()
	}),

	activateAction: zod.object({
		card: zod.string()
	}),

	chooseCards: zod.object({
		cards: zod.array(zod.string())
	}),

	chooseZones: zod.object({
		zones: zod.array(zod.object({
			location: zod.number().int().min(0),
			column: zod.number().int().min(0)
		}))
	}),

	chooseYesNo: zod.object({
		choice: zod.boolean()
	}),

	chooseOption: zod.object({
		choice: zod.number().int().min(0)
	}),

}

export type SetIngredientActionParams = zod.output<typeof actionSchemas.setIngredient>
export type CookSummonActionParams = zod.infer<typeof actionSchemas.cookSummon>
export type AttackActionParams = zod.infer<typeof actionSchemas.attack>
export type ActivateActionCardParams = zod.infer<typeof actionSchemas.activateAction>
export type ChooseCardsParams = zod.infer<typeof actionSchemas.chooseCards>
export type ChooseZonesParams = zod.infer<typeof actionSchemas.chooseZones>
export type ChooseYesNoParams = zod.infer<typeof actionSchemas.chooseYesNo>
export type ChooseOptionParams = zod.infer<typeof actionSchemas.chooseOption>