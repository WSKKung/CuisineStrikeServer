import { Card } from "../model/cards"
import { Recipe, RecipeSlotFilter } from "../model/recipes"

export namespace DishSummonProcedure {

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
		let recipeData = recipeListData[code];

		if (!recipeData) {
			return null;
		}

		recipeCache[code] = recipeData;
		nk.localcachePut("recipes", recipeCache);
		return recipeData;
	}

	export function checkIsRecipeComplete(recipe: Recipe, card: Card, materials: Array<Card>): boolean {

		let slots = recipe.slots;

		// thanks to ChatGPT for this algo's idea, without it I would go commit aliven't by now
		function backtrackCheck(materialIndex: number, usedMaterialPerSlots: Array<Array<Card>>): boolean {
			// all materials are assigned to recipe slot
			if (materialIndex === materials.length) {
				
				// check minimum material count for each slot
				for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
					let slot = slots[slotIndex];
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

			for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
				let slot = slots[slotIndex];
				let slotMaterials = usedMaterialPerSlots[slotIndex];

				// skip slot that is already full
				if (slotMaterials.length >= slot.max) {
					continue;
				}

				// skip incompatible slot
				if (!checkMaterialMatchingFilter(slot.condition, card, currentMaterial)) {
					continue;
				}

				// marks current materials as used with current slot
				slotMaterials.push(currentMaterial);

				// go to next materials with the updated used materials
				let nextResult = backtrackCheck(materialIndex + 1, usedMaterialPerSlots);
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

		return backtrackCheck(0, slots.map<Array<Card>>(_ => []));
	/*
		function backtrackCheckMinimumRecipeRequired(slotNumber: number, usedMaterialPerSlots: Array<Array<Card>>): [ boolean, Array<Card> ] {
			// Recipe is completed, the minimum material needed to fill the recipe exists with combination of current used materials
			if (slotNumber === slots.length) {
				return [ true, usedMaterialPerSlots.reduce((prev, next) => prev.concat(next), []) ];
			}

			let slot = slots[slotNumber];

			for (let material of materials) {
				// skip used materials
				if (usedMaterialPerSlots.some(usedMaterials => usedMaterials.some(usedCard => material.id === usedCard.id))) {
					continue;
				}
				
				// skip material that does not match the slot
				if (!checkMaterialMatchingFilter(slot.condition, card, material)) {
					continue;
				}

				// marks the current materials as used
				usedMaterialPerSlots[slotNumber].push(material);

				// If the slot's minimum requirement is fulfilled, then move to the next slot, otherwise still on the same slot
				let nextSlot = usedMaterialPerSlots[slotNumber].length === slot.min ? slotNumber + 1 : slotNumber;
				let nextResult = backtrackCheckMinimumRecipeRequired(nextSlot, usedMaterialPerSlots);
				// and immediately return the result if recipe is completed
				if (nextResult[0]) {
					return nextResult;
				}

				// remove the current materials to backtrack
				usedMaterialPerSlots[slotNumber].pop();
			}

			return [ false, [] ];
		}

		
		let [ passedMinimum, minimumMaterials ] = backtrackCheckMinimumRecipeRequired(0, slots.map<Array<Card>>(_ => []));
		if (!passedMinimum) {
			return false;
		}

		// find remaining slot for each of remaining material

		return true;
		*/
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
}
