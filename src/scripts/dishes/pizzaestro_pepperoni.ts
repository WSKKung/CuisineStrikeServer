import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

function getHPCost(card: Card): number {
	return Card.getBonusGrade(card)
}
 
export const PIZZAESTRO_PEPPERONI_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		// cost requirement for paying hp 
		let hp_cost = getHPCost(card)
		if (hp_cost <= 0 || Match.getHP(state, player) <= hp_cost) return false;
		// require valid target on field
		if (Match.countFilterCards(state, () => true, CardLocation.SERVE_ZONE, Match.getOpponent(state, player)) <= 0) return false;
		return true;
	},
	async activate({ state, player, card}) {
		await Match.payHP(state, { player, reason: EventReason.EFFECT | EventReason.COST }, player, getHPCost(card));
		Match.addBuff(state, { player, reason: EventReason.EFFECT }, [card], {
			id: Match.newUUID(state),
			type: "pierce",
			operation: "add",
			amount: 1,
			sourceCard: card,
			resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
		});
		
		let validTargets = Match.findCards(state, () => true, CardLocation.SERVE_ZONE, Match.getOpponent(state, player));
		let selectedTargets = await Match.makePlayerSelectCards(state, { player, reason: EventReason.EFFECT }, player, validTargets, 1, 1);
		if (selectedTargets.length > 0) {
			let damage = getHPCost(card) * 2;
			await Match.damage(state, { player, reason: EventReason.EFFECT }, selectedTargets, damage);
		}
	},
}