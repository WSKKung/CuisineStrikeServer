import zod from "zod";
import { GameConfiguration } from "./constants";

export type ActionType = 
	"end_turn" |
	"go_to_strike_phase" |
	"set_ingredient" |
	"cook_summon" |
	"attack" |
	"activate_action" |
	"choose_cards"

export interface ActionResult {
	id: string,
	type: ActionType
	owner: string
	data?: any
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
	})
}

export type SetIngredientActionParams = zod.output<typeof actionSchemas.setIngredient>
export type CookSummonActionParams = zod.infer<typeof actionSchemas.cookSummon>
export type AttackActionParams = zod.infer<typeof actionSchemas.attack>
export type ActivateActionCardParams = zod.infer<typeof actionSchemas.activateAction>
export type ChooseCardsParams = zod.infer<typeof actionSchemas.chooseCards>