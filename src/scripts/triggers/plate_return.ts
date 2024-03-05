import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

function recycleFilter(card: Card, player: string): boolean {
	return Card.getOwner(card) === player && Card.hasType(card, CardType.DISH);
}

function setIngredientFilter(card: Card, recycledDish: Card): boolean {
	return Card.hasType(card, CardType.INGREDIENT) && Card.getGrade(card) <= 2 && Card.getGrade(card) <= Card.getBaseGrade(recycledDish);
}

const PLATE_RETURN_EFFECT: CardEffect = {
	type: "trigger",
	resolutionPhase: "after",
	condition({ state, player, card, event }) {
		return !!event && event.type === "destroy" && event.cards.some(card => recycleFilter(card, player))
	},
	async activate({ state, player, card, event }) {
		if (!event || event.type !== "destroy") return;
		let destroyedCards = event.cards.filter(card => recycleFilter(card, player));
		if (destroyedCards.length > 1) {
			Match.setSelectionHint(state, "Select a card to recycle");
			destroyedCards = await Match.makePlayerSelectCards(state, player, destroyedCards, 1, 1);
		}
		await Match.recycle(state, { player: player, reason: EventReason.EFFECT }, destroyedCards, "shuffle");
		let destroyedCard = destroyedCards[0];
		if (Match.getFreeZoneCount(state, player, CardLocation.STANDBY_ZONE) > 0) {
			let canRecycleCards = Match.findCards(state, c => setIngredientFilter(c, destroyedCard), CardLocation.TRASH, player);
			if (canRecycleCards.length > 0) {
				Match.setSelectionHint(state, "Select a card to Set to the field");
				if (await Match.makePlayerSelectYesNo(state, player)) {
					let cardToRecycle = await Match.makePlayerSelectCards(state, player, canRecycleCards, 1, 1);
					let zoneToPlaceTo = await Match.makePlayerSelectFreeZone(state, player, CardLocation.STANDBY_ZONE, player);
					if (zoneToPlaceTo) {
						await Match.setToStandby(state, { player: player, reason: EventReason.EFFECT }, cardToRecycle[0], player, zoneToPlaceTo.column);
					}
				}
			}
			//event.negated = true;
		}
	},
}

export default PLATE_RETURN_EFFECT;