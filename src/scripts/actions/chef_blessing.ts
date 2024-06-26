import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation } from "../../model/cards";
import { Match } from "../../match";
import { CardEffect, CardEffectContext } from "../../model/effect";
import { Utility } from "../../utility";
import { EventReason } from "../../model/events";

function costFilter(context: CardEffectContext, card: Card) {
	return !Card.isSame(card, context.card)
}

const CHEF_BLESSING_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		// implicit condition: must have at least 1 valid target on field and 1 valid cost target on hand (except this card)
		return Match.countCards(context.state, CardLocation.SERVE_ZONE, context.player) > 0 && Match.countFilterCards(context.state, (card) => costFilter(context, card), CardLocation.HAND, context.player) > 0;
	},

	async activate(context) {
		Match.setSelectionHint(context.state, "Select a card to discard")
		let discardChoice: Array<Card> = await Match.makePlayerSelectCards(context.state, { player: context.player, reason: EventReason.EFFECT }, context.player, Match.findCards(context.state, (card) => costFilter(context, card), CardLocation.HAND, context.player), 1, 1);
		await Match.discard(context.state, { player: context.player, reason: EventReason.EFFECT }, discardChoice);
		
		Match.setSelectionHint(context.state, "Select a Dish to grant buff")
		let choice: Array<Card> = await Match.makePlayerSelectCards(context.state, { player: context.player, reason: EventReason.EFFECT }, context.player, Match.getCards(context.state, CardLocation.SERVE_ZONE, context.player), 1, 1);
		let atkBuff: CardBuff = {
			id: Match.newUUID(context.state),
			sourceCard: context.card,
			type: "power",
			operation: "add",
			amount: 1,
			resets: CardBuffResetCondition.TARGET_REMOVED
		};
		let defBuff = Utility.shallowClone(atkBuff) as CardBuff;
		defBuff.type = "health"
		let gradeBuff = Utility.shallowClone(atkBuff) as CardBuff;
		gradeBuff.type = "grade"
		Match.addBuff(context.state, { player: context.player, reason: EventReason.EFFECT }, choice, atkBuff);
		Match.addBuff(context.state, { player: context.player, reason: EventReason.EFFECT }, choice, defBuff);
		Match.addBuff(context.state, { player: context.player, reason: EventReason.EFFECT }, choice, gradeBuff);
	}
};

export default CHEF_BLESSING_EFFECT;
