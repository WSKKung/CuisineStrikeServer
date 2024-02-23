import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

const BACON_AND_EGG_WARRIOR_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Card.hasLocation(context.card, CardLocation.SERVE_ZONE) && Card.getBonusGrade(context.card) > 0;
	},
	async activate(context) {
		let gainedPower = Card.getBonusGrade(context.card);
		if (gainedPower > 0) {
			let dishCards = Match.findCards(context.state, () => true, CardLocation.SERVE_ZONE, context.player);
			let powerBuff: CardBuff = {
				id: Match.newUUID(context.state),
				type: "power",
				operation: "add",
				amount: gainedPower,
				sourceCard: context.card,
				resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
			};
			Match.addBuff(context.state, dishCards, powerBuff);
		}
	},
}

export default BACON_AND_EGG_WARRIOR_EFFECT;