import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation } from "../../card";
import { Match } from "../../match";
import { CardEffect } from "../../effects/effect";
import { Utility } from "../../utility";

const CHEF_BLESSING_EFFECT: CardEffect = {
	type: "active",
	condition(context) {
		return Match.countCards(context.state, CardLocation.SERVE_ZONE, context.player) > 0;
	},

	async activate(context) {
		let choice: Array<Card> = await Match.makePlayerSelectCards(context.state, context.player, Match.getCards(context.state, CardLocation.SERVE_ZONE, context.player), 1, 1);
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
		Match.addBuff(context.state, choice, atkBuff);
		Match.addBuff(context.state, choice, defBuff);
		Match.addBuff(context.state, choice, gradeBuff);
	}
};

export default CHEF_BLESSING_EFFECT;
