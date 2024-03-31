import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

export const EGG_SALADSAINT_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		return Match.countCards(state, CardLocation.MAIN_DECK, player) > 0;
	},
	async activate({ state, player, card}) {
		let discardTargets = Match.getTopCards(state, 1, CardLocation.MAIN_DECK, player);
		await Match.discard(state, { player, reason: EventReason.EFFECT | EventReason.COST }, discardTargets);

		let discardedCard = discardTargets[0];
		if (Card.hasType(discardedCard, CardType.INGREDIENT)) {
			let gainedHealth = Card.getGrade(discardedCard);
			Match.addBuff(state, { player, reason: EventReason.EFFECT }, [card], {
				id: Match.newUUID(state),
				type: "health",
				operation: "add",
				amount: gainedHealth,
				sourceCard: card,
				resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
			});
			await Match.healPlayer(state, { player, reason: EventReason.EFFECT }, player, gainedHealth);
		}
	},
}