import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation, CardType } from "../../model/cards";
import { Match } from "../../match";
import { CardEffect } from "../../effects/effect";
import { EventReason } from "../../events";

function recycleFilter(card: Card) {
	return Card.hasType(card, CardType.DISH)
}

const RECIPE_RECALL_EFFECT: CardEffect = {
	type: "active",
	condition(context) {
		return Match.countFilterCards(context.state, recycleFilter, CardLocation.TRASH, context.player) > 0;
	},

	async activate(context) {
		let cardOptions = Match.findCards(context.state, recycleFilter, CardLocation.TRASH, context.player);
		let choice: Array<Card> = await Match.makePlayerSelectCards(context.state, context.player, cardOptions, 1, 1);
		Match.sendToDeck(context.state, choice, context.player, "shuffle", EventReason.EFFECT);
		Match.drawCard(context.state, context.player, 1);
	}
};

export default RECIPE_RECALL_EFFECT;
