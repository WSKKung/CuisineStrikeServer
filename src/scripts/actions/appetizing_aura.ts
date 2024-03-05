import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation } from "../../model/cards";
import { Match } from "../../match";
import { CardEffect, CardEffectContext } from "../../model/effect";
import { Utility } from "../../utility";
import { EventReason } from "../../model/events";

const APPETIZING_AURA_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		// implicit condition: must have at least 1 valid target on field and 1 valid cost target on hand (except this card)
		return Match.countCards(context.state, CardLocation.SERVE_ZONE, context.player) > 0
	},

	async activate(context) {
		Match.setSelectionHint(context.state, "Select a Dish")
		let choice: Array<Card> = await Match.makePlayerSelectCards(context.state, context.player, Match.getCards(context.state, CardLocation.SERVE_ZONE, context.player), 1, 1);
		await Match.healPlayer(context.state, { player: context.player, reason: EventReason.EFFECT }, context.player, Card.getPower(choice[0]))
	}
};

export default APPETIZING_AURA_EFFECT;
