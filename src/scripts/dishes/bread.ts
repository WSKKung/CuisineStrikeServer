import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../effects/effect";
import { EventReason } from "../../events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

const BREAD_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Card.hasLocation(context.card, CardLocation.SERVE_ZONE) && Card.getGrade(context.card) >= 3
	},
	async activate(context) {
		let powerBuff: CardBuff = {
			id: Match.newUUID(context.state),
			type: "power",
			operation: "add",
			amount: 2,
			sourceCard: context.card,
			resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
		};
		Match.addBuff(context.state, [context.card], powerBuff);
	},
}

export default BREAD_EFFECT;