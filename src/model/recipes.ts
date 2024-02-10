import { z } from "zod";

export interface Recipe {
	slots: RecipeSlot[];
}

export interface RecipeSlot {
	min: number;
	max: number;
	condition: RecipeSlotFilter;
}

export type RecipeSlotFilter =
	AnyRecipeSlotFilter |
	NotRecipeSlotFilter |
	AndRecipeSlotFilter |
	OrRecipeSlotFilter |
	CheckCodeRecipeSlotFilter |
	CheckTypeRecipeSlotFilter |
	CheckGradeRecipeSlotFilter |
	CheckClassRecipeSlotFilter;

export type AnyRecipeSlotFilter = {
	type: "any"
}

export type NotRecipeSlotFilter = {
	type: "not"
	condition: RecipeSlotFilter
}

export type AndRecipeSlotFilter = {
	type: "and"
	conditions: Array<RecipeSlotFilter>
}

export type OrRecipeSlotFilter = {
	type: "or"
	conditions: Array<RecipeSlotFilter>
}

export type CheckTypeRecipeSlotFilter = {
	type: "check_card_type"
	card_type: number
}

export type CheckCodeRecipeSlotFilter = {
	type: "check_code",
	code: number
}

export type CheckGradeRecipeSlotFilter = {
	type: "check_grade"
	min: number
	max: number
}

export type CheckClassRecipeSlotFilter = {
	type: "check_classes",
	classes: number
}

export const RecipeSchemas = {
	RECIPE: z.custom<Recipe>()
}
