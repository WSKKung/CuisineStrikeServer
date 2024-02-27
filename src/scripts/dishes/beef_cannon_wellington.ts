import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

const BEEF_CANNON_WELLINGTON_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Card.hasLocation(context.card, CardLocation.SERVE_ZONE) && Match.countCards(context.state, CardLocation.MAIN_DECK, context.player) > 0
	},
	async activate(context) {
		let discardedCard = Match.getTopCards(context.state, 1, CardLocation.MAIN_DECK, context.player)[0];
		await Match.discard(context.state, [discardedCard], context.player, EventReason.EFFECT);
		if (Card.hasType(discardedCard, CardType.INGREDIENT)) {
			let powerGained = Card.getGrade(discardedCard)
			let powerBuff: CardBuff = {
				id: Match.newUUID(context.state),
				type: "health",
				operation: "add",
				amount: powerGained,
				sourceCard: context.card,
				resets: CardBuffResetCondition.TARGET_REMOVED
			};
			Match.addBuff(context.state, [context.card], powerBuff);
		}
	},
}

export default BEEF_CANNON_WELLINGTON_EFFECT;