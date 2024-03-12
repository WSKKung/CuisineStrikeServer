import { Card } from "../model/cards"
import { EMPTY_RECIPE, Recipe, RecipeSchemas, RecipeSlotFilter } from "../model/recipes"

export namespace DishSummonProcedure {

	// thanks to ChatGPT for this algo's idea, without it I would go commit aliven't by now
	/** Check if recipe is completed recursively.
	 * @param recipe A recipe to check
	 * @param card A card that own the checking recipe 
	 * @param materials Array of cards to check as materials against the recipe
	 * @param materialsIndex Index of iterating materials
	 * @param materialsIndex Array of cards assigned to recipe slot correspond to the index of their subarray in current iteration (for example, usedMaterialPerSlots[n] represents every card currently assigned for nth sloth in the recipe.)
	 */ 
	function backtrackCheckRecipeMaterialsExact(recipe: Recipe, card: Card, materials: Array<Card>, materialIndex: number, usedMaterialPerSlots: Array<Array<Card>>): boolean {
		// all materials are assigned to recipe slot
		if (materialIndex === materials.length) {
			
			// check minimum material count for each slot
			for (let slotIndex = 0; slotIndex < recipe.slots.length; slotIndex++) {
				let slot = recipe.slots[slotIndex];
				let slotMaterials = usedMaterialPerSlots[slotIndex];
				// failed, current slot have no enough material
				if (slotMaterials.length < slot.min) {
					return false;
				}
			}

			// success, all materials assigned to some slots and all slots fulfill its material requirement
			return true;
		}

		let currentMaterial = materials[materialIndex];

		// Iterate through every slots in the recipe
		for (let slotIndex = 0; slotIndex < recipe.slots.length; slotIndex++) {
			let slot = recipe.slots[slotIndex];
			let slotMaterials = usedMaterialPerSlots[slotIndex];

			// skip slot that is already full
			if (slotMaterials.length >= slot.max) {
				continue;
			}

			// skip current slot if the current material is not compatible with
			if (!checkMaterialMatchingFilter(slot.condition, card, currentMaterial)) {
				continue;
			}

			// assign current material to current slot
			slotMaterials.push(currentMaterial);

			// check recursively with other slot with the next material
			let nextResult = backtrackCheckRecipeMaterialsExact(recipe, card, materials, materialIndex + 1, usedMaterialPerSlots);
			if (nextResult) {
				// only pass success result back
				// for failed result will be backtracked to the next material
				return nextResult;
			}

			// unmarks to backtrack to check next material
			slotMaterials.pop();

		}

		// failed, current material cannot be assigned to any slot
		return false;
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
		return backtrackCheckRecipeMaterialsExact(recipe, card, materials, 0, recipe.slots.map<Array<Card>>(_ => []));
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


	function checkMaterialMatchingFilter(filter: RecipeSlotFilter, card: Card, material: Card): boolean {
		switch (filter.type) {
			case "any":
				return true;

			case "not":
				return !checkMaterialMatchingFilter(filter.condition, material, material);

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
	
	/** Check if recipe is completed recursively.
	 * @param recipe A recipe to check
	 * @param card A card that own the checking recipe 
	 * @param materials Array of cards to check as materials against the recipe
	 * @param materialsIndex Index of iterating materials
	 * @param materialsIndex Array of cards assigned to recipe slot correspond to the index of their subarray in current iteration (for example, usedMaterialPerSlots[n] represents every card currently assigned for nth sloth in the recipe.)
	 * @params combinations Array of combinations of materials that can be used to complete the recipe
	*/ 
	function backtrackGetRecipeCombinations(recipe: Recipe, card: Card, materials: Array<Card>, materialIndex: number, usedMaterialPerSlots: Array<Array<Card>>, combinations: Array<Array<Card>>): void {
		// all materials are assigned to recipe slot
		if (materialIndex === materials.length) {
			
			// check minimum material count for each slot
			for (let slotIndex = 0; slotIndex < recipe.slots.length; slotIndex++) {
				let slot = recipe.slots[slotIndex];
				let slotMaterials = usedMaterialPerSlots[slotIndex];
				// failed, current slot have no enough material
				if (slotMaterials.length < slot.min) {
					return;
				}
			}

			// success, all materials assigned to some slots and all slots fulfill its material requirement
			let foundCombination = usedMaterialPerSlots.reduce((a, b) => a.concat(b), []);
			if (foundCombination.length > 0) {
				combinations.push(foundCombination);
			}
			return;
		}

		let currentMaterial = materials[materialIndex];

		// Iterate through every slots in the recipe
		for (let slotIndex = 0; slotIndex < recipe.slots.length; slotIndex++) {
			let slot = recipe.slots[slotIndex];
			let slotMaterials = usedMaterialPerSlots[slotIndex];

			// skip slot that is already full
			if (slotMaterials.length >= slot.max) {
				continue;
			}

			// skip current slot if the current material is not compatible with
			if (!checkMaterialMatchingFilter(slot.condition, card, currentMaterial)) {
				continue;
			}

			// assign current material to current slot
			slotMaterials.push(currentMaterial);

			// check recursively with other slot with the next material
			backtrackGetRecipeCombinations(recipe, card, materials, materialIndex + 1, usedMaterialPerSlots, combinations);

			// unmarks to backtrack to check next material
			slotMaterials.pop();

		}
	}

	export function getRecipeValidCombinations(recipe: Recipe, card: Card, materials: Array<Card>): Array<Array<Card>> {
		let combinations: Array<Array<Card>> = [];
		backtrackGetRecipeCombinations(recipe, card, materials, 0, recipe.slots.map(_ => []), combinations);
		combinations = combinations.filter(combination => combination.map(Card.getGrade).reduce((g1,g2) => g1 + g2, 0) >= Card.getBaseGrade(card) )
		return combinations;
	}
}
