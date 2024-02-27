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
		Match.setSelectionHint(context.state, "HINT_SELECT_RECYCLE")
		let cardOptions = Match.findCards(context.state, recycleFilter, CardLocation.TRASH, context.player);
		let choice: Array<Card> = await Match.makePlayerSelectCards(context.state, context.player, cardOptions, 1, 1);
		await Match.recycle(context.state, context.player, choice, "shuffle", EventReason.EFFECT);
		await Match.drawCard(context.state, context.player, 1, EventReason.EFFECT);
	}
};

export default RECIPE_RECALL_EFFECT;
