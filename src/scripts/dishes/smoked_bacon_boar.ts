import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

function recycleFilter(card: Card): boolean {
	return Card.hasType(card, CardType.DISH);
}

const SMOKED_BACON_BOAR_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Card.hasLocation(context.card, CardLocation.SERVE_ZONE) && Match.countCards(context.state, CardLocation.MAIN_DECK, context.player) > 0
	},
	async activate(context) {
		let discardedCard = Match.getTopCards(context.state, 1, CardLocation.MAIN_DECK, context.player)[0];
		await Match.discard(context.state, { player: context.player, reason: EventReason.EFFECT }, [discardedCard]);
		if (Card.hasType(discardedCard, CardType.INGREDIENT)) {
			let powerGained = Card.getGrade(discardedCard) * 2
			let powerBuff: CardBuff = {
				id: Match.newUUID(context.state),
				type: "power",
				operation: "add",
				amount: powerGained,
				sourceCard: context.card,
				resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
			};
			Match.addBuff(context.state, { player: context.player, reason: EventReason.EFFECT }, [context.card], powerBuff);
		}
	},
}

export default SMOKED_BACON_BOAR_EFFECT;