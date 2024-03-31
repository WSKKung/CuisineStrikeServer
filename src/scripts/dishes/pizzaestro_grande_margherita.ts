import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

const HP_COST = 1;

export const PIZZAESTRO_GRANDE_MARGHERITA_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		// cost requirement for paying hp equal to its grade
		if (Match.getHP(state, player) <= HP_COST) return false;
		return true;
	},
	async activate({ state, player, card}) {
		await Match.payHP(state, { player, reason: EventReason.EFFECT | EventReason.COST }, player, HP_COST);
		Match.addBuff(state, { player, reason: EventReason.EFFECT }, [card], {
			id: Match.newUUID(state),
			type: "pierce",
			operation: "add",
			amount: 1,
			sourceCard: card,
			resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
		});
		
		if (Match.getHP(state, player) < Match.getHP(state, Match.getOpponent(state, player))) {
			Match.addCardAttackCount(state, card, 1)
		}
	},
}