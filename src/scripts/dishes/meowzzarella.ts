import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

function getHPCost(card: Card): number {
	return Card.getGrade(card);
}

export const MEOWZARELLA_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		// while being standby
		if (!Card.hasLocation(card, CardLocation.STANDBY_ZONE)) return false;
		// cost requirement for paying hp equal to its grade
		let hp_cost = getHPCost(card);
		if (hp_cost <= 0 || Match.getHP(state, player) <= hp_cost) return false;
		// effect requirement for targeting a unit
		if (Match.countCards(state, CardLocation.SERVE_ZONE, Match.getOpponent(state, player)) <= 0) return false;
		return true;
	},
	async activate({ state, player, card}) {
		await Match.payHP(state, { player, reason: EventReason.EFFECT | EventReason.COST }, player, getHPCost(card));

		let targetChoices = Match.findCards(state, (card) => true, CardLocation.SERVE_ZONE, Match.getOpponent(state, player));
		let targetSelections = await Match.makePlayerSelectCards(state, { player, reason: EventReason.EFFECT }, player, targetChoices, 1, 1);

		if (targetSelections.length > 0) {
			let debuffAmount = -Card.getGrade(card);
			Match.addBuff(state, { player, reason: EventReason.EFFECT }, targetSelections, {
				id: Match.newUUID(state),
				type: "power",
				operation: "add",
				amount: debuffAmount,
				sourceCard: card,
				resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
			});
		}
	},
}