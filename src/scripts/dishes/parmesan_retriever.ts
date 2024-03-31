import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { BitField } from "../../utility";

function isIngredientMatchDish(dishCard: Card, ingredientCard: Card): boolean {
	return BitField.any(Card.getClass(dishCard), Card.getClass(ingredientCard));
}

function targetIngredientFilter(card: Card, dishCards: Array<Card>): boolean {
	return Card.hasType(card, CardType.INGREDIENT) && dishCards.some(dish => isIngredientMatchDish(dish, card))
}

function targetDishFilter(card: Card, ingredientCards: Array<Card>): boolean {
	return ingredientCards.some(ingredient => isIngredientMatchDish(card, ingredient))
}

export const PARMESAN_RETRIEVER_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		// while being served
		if (!Card.hasLocation(card, CardLocation.SERVE_ZONE)) return false;
		// must have lower hp than opponent's
		if (Match.getHP(state, player) > Match.getHP(state, Match.getOpponent(state, player))) return false;
		// effect requirement for targeting a unit
		let dishCards = Match.getCards(state, CardLocation.RECIPE_DECK, player);
		let validIngredientCards = Match.findCards(state, card => targetIngredientFilter(card, dishCards), CardLocation.TRASH, player);
		return validIngredientCards.length > 0;
	},

	async activate({ state, player, card}) {
		let dishCards = Match.getCards(state, CardLocation.RECIPE_DECK, player);
		let validIngredientCards = Match.findCards(state, card => targetIngredientFilter(card, dishCards), CardLocation.TRASH, player);
		let validDishCards = Match.findCards(state, card => targetDishFilter(card, validIngredientCards), CardLocation.RECIPE_DECK, player);
		let targetSelectSelections = await Match.makePlayerSelectCards(state, { player, reason: EventReason.EFFECT }, player, validDishCards, 1, 1);
		if (targetSelectSelections.length > 0) {
			let targetDish = targetSelectSelections[0];
			validIngredientCards = validIngredientCards.filter(card => isIngredientMatchDish(card, targetDish));
			let targetToHandSelections = await Match.makePlayerSelectCards(state, { player, reason: EventReason.EFFECT }, player, validIngredientCards, 1, 1);
			if (targetToHandSelections.length > 0) {
				Match.addToHand(state, { player, reason: EventReason.EFFECT }, targetToHandSelections);
			}
		}
	},
}