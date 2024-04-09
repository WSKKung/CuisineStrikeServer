import { Card } from "../model/cards"
import { EMPTY_RECIPE, Recipe, RecipeSchemas, RecipeSlot, RecipeSlotFilter } from "../model/recipes"

export namespace DishSummonProcedure {
	
	function checkMaterialMatchingFilter(filter: RecipeSlotFilter, card: Card, material: Card): boolean {
		switch (filter.type) {
			case "any":
				return true;

			case "not":
				return !checkMaterialMatchingFilter(filter.condition, card, material);

			// pass if all of its subconditions passed
			case "and":
				return filter.conditions.every(subcondition => checkMaterialMatchingFilter(subcondition, card, material));

			// pass if any of its subcondition passed
			case "or":
				return filter.conditions.some(subcondition => checkMaterialMatchingFilter(subcondition, card, material));

			case "check_card_type":
				return Card.hasType(material, filter.card_type);

			case "check_code":
				return Card.getCode(material) === filter.code;
			
			case "check_grade":
				let grade = Card.getGrade(material)
				return grade >= filter.min && grade <= filter.max;

			case "check_classes":
				return Card.hasClass(material, filter.classes);

			default:
				return false;
		}
	}

	function checkMaterialMatchingSlot(slot: RecipeSlot, card: Card, material: Card): boolean {
		return checkMaterialMatchingFilter(slot.condition, card, material);
	}

	/**
	 * Check if given material combinations fulfill the recipe of the given card.
	 * Note that to pass the test, EVERY materials must be used.
	 * @param recipe A recipe to check
	 * @param card A card that own the checking recipe 
	 * @param materials Array of cards to check as materials against the recipe
	 * @returns 
	 */
	export function checkIsRecipeComplete(recipe: Recipe, card: Card, materials: Array<Card>): boolean {
		type CombinationMatchState = {
			current_material_index: number,
			slots: Card[][] // stores assigned materials in each slots
		};
	
		let stack: CombinationMatchState[] = [];
		stack.push({
			current_material_index: 0,
			slots: recipe.slots.map(_ => ([]))
		})
		
		// use backtracking technique
		while (stack.length > 0) {
			let state = stack.pop()!;
	
			let every_slot_fullfilled = state.slots.every((slot_state, slot_index) => {
				let checking_slot = recipe.slots[slot_index];
				let matched_material_count = slot_state.length;
				return matched_material_count >= checking_slot.min && matched_material_count <= checking_slot.max;
			});
			let every_material_used = state.current_material_index >= materials.length;
	
			if (every_slot_fullfilled && every_material_used) {
				let new_combination = state.slots.reduce((a1, a2) => a1.concat(a2), []);
				if (new_combination.map(mat => Card.getGrade(mat)).reduce((g1,g2) => g1+g2, 0) >= Card.getBaseGrade(card)) return true;
			}
			
			if (every_material_used) {
				continue;
			}
	
			let material = materials[state.current_material_index];
			
			recipe.slots.forEach((slot, slot_index) => {
				let slot_state = state.slots[slot_index];
	
				// if current material can assign to current slot, try to assign it and check for next material
				if (slot_state.length < slot.max && checkMaterialMatchingSlot(slot, card, material)) {
					let next_state: CombinationMatchState = {
						current_material_index: state.current_material_index + 1,
						slots: [...state.slots]
					}
					next_state.slots[slot_index] = slot_state.concat(material);
					stack.push(next_state);
				}
				// otherwise, check next material and skip current material
				//stack.push(next_state);
			});
	
		}
	
		return false;
	}

	export function loadRecipeFromCardCode(code: number, nk: nkruntime.Nakama): Recipe | null {
		// load from cache
		let recipeCache = nk.localcacheGet("recipes") || {};
		// read database
		let queryResult = nk.storageRead([
			{
				collection: "system",
				key: "recipes",
				userId: "00000000-0000-0000-0000-000000000000"
			}
		]);
		let recipeListData = (queryResult[0] && queryResult[0].value) || {};
		let recipeParseResult = RecipeSchemas.RECIPE.safeParse(recipeListData[code])
		if (!recipeParseResult.success) {
			return EMPTY_RECIPE;
		}
		let recipeData = recipeParseResult.data;
		recipeCache[code] = recipeData;
		nk.localcachePut("recipes", recipeCache);
		return recipeData;
	}
	
	export function getRecipeValidCombinations(recipe: Recipe, card: Card, materials: Array<Card>): Array<Array<Card>> {
		type CombinationMatchState = {
			current_material_index: number,
			slots: Card[][] // stores assigned materials in each slots
		};
	
		// use backtracking technique
		let stack: CombinationMatchState[] = [];
		stack.push({
			current_material_index: 0,
			slots: recipe.slots.map(_ => ([]))
		})
		let combinations: Card[][] = [];

		while (stack.length > 0) {
			let state = stack.pop()!;
	
			let every_slot_fullfilled = state.slots.every((slot_state, slot_index) => {
				let checking_slot = recipe.slots[slot_index];
				let matched_material_count = slot_state.length;
				return matched_material_count >= checking_slot.min && matched_material_count <= checking_slot.max;
			});
			let every_material_used = state.current_material_index >= materials.length;
			
			if (every_slot_fullfilled) {
				let new_combination = state.slots.reduce((a1, a2) => a1.concat(a2), []);
				if (new_combination.map(mat => Card.getGrade(mat)).reduce((g1,g2) => g1+g2, 0) >= Card.getBaseGrade(card)) {
					combinations.push(new_combination);
				}
			}

			if (every_material_used) {
				continue;
			}
	
			let material = materials[state.current_material_index];
			
			recipe.slots.forEach((slot, slot_index) => {
				let slot_state = state.slots[slot_index];
				let next_state: CombinationMatchState = {
					current_material_index: state.current_material_index + 1,
					slots: [...state.slots]
				}
	
				// if current material can assign to current slot, try to assign it and check for next material
				if (slot_state.length < slot.max && checkMaterialMatchingSlot(slot, card, material)) {
					next_state.slots[slot_index] = slot_state.concat(material);
				}
				// otherwise, check next material and skip current material
	
				stack.push(next_state);
			});
	
		}
	
		return combinations;
	}
}
