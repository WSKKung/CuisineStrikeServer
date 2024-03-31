import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

function getHPCost(card: Card): number {
	return Card.getGrade(card) * 2
}

function targetFilter(card: Card, activatedCard: Card): boolean {
	return Card.hasType(card, CardType.DISH) && Card.getGrade(card) <= Card.getGrade(activatedCard);
}

export const SUMMONING_CRUST_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		// while being served
		if (!Card.hasLocation(card, CardLocation.SERVE_ZONE)) return false;
		// cost requirement for paying hp equal to its grade
		let payCost = getHPCost(card)
		if (Match.getHP(state, player) <= payCost) return false;
		// effect requirement for targeting a unit
		if (Match.countFilterCards(state, targetCard => targetFilter(targetCard, card), CardLocation.TRASH, player) <= 0) return false;
		// must have free space to summon target
		if (Match.getFreeZoneCount(state, player, CardLocation.SERVE_ZONE) <= 0) return false;
		return true;
	},

	async activate({ state, player, card }) {
		let payAmount = await Match.payHP(state, { player, reason: EventReason.EFFECT | EventReason.COST }, player, getHPCost(card));
		if (payAmount <= 0) return;
		
		let targetChoices = Match.findCards(state, targetCard => targetFilter(targetCard, card), CardLocation.TRASH, player);
		let targetSelections = await Match.makePlayerSelectCards(state, { player, reason: EventReason.EFFECT }, player, targetChoices, 1, 1);

		if (targetSelections.length > 0) {
			let targetCard = targetSelections[0];
			let targetZone = await Match.makePlayerSelectFreeZone(state, { player, reason: EventReason.EFFECT }, player, CardLocation.SERVE_ZONE);
			if (!targetZone) return;
			await Match.summon(state, { player, reason: EventReason.EFFECT }, targetCard, player, targetZone.column, false);
			Match.setCardAttackCount(state, targetCard, 0);
		}
	},
}