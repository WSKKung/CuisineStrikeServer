import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation } from "../../model/cards";
import { Match } from "../../match";
import { CardEffect } from "../../effects/effect";

const PEPPER_UP_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Match.countCards(context.state, CardLocation.SERVE_ZONE, context.player) > 0;
	},

	async activate(context) {
		Match.setSelectionHint(context.state, "HINT_SELECT_GRANT_BUFF")
		let choice: Array<Card> = await Match.makePlayerSelectCards(context.state, context.player, Match.getCards(context.state, CardLocation.SERVE_ZONE, context.player), 1, 1);
		let atkBoostBuff: CardBuff = {
			id: Match.newUUID(context.state),
			sourceCard: context.card,
			type: "power",
			operation: "add",
			amount: 3,
			resets: CardBuffResetCondition.END_TURN | CardBuffResetCondition.TARGET_REMOVED
		}
		Match.addBuff(context.state, choice, atkBoostBuff);
	}
};

export default PEPPER_UP_EFFECT;
