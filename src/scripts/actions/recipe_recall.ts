import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation, CardType } from "../../model/cards";
import { Match } from "../../match";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

function recycleFilter(card: Card) {
	return Card.hasType(card, CardType.DISH)
}

const RECIPE_RECALL_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Match.countFilterCards(context.state, recycleFilter, CardLocation.TRASH, context.player) > 0;
	},

	async activate(context) {
		Match.setSelectionHint(context.state, "Select a card to recycle")
		let cardOptions = Match.findCards(context.state, recycleFilter, CardLocation.TRASH, context.player);
		let choice: Array<Card> = await Match.makePlayerSelectCards(context.state, { player: context.player, reason: EventReason.EFFECT }, context.player, cardOptions, 1, 1);
		await Match.recycle(context.state, { player: context.player, reason: EventReason.EFFECT }, choice, "shuffle");
		await Match.drawCard(context.state, { player: context.player, reason: EventReason.EFFECT }, context.player, 1);
	}
};

export default RECIPE_RECALL_EFFECT;
