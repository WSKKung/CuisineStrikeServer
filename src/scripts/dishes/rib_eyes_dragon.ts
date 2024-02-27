import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

const RIB_EYES_DRAGON_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Match.countFilterCards(context.state, () => true, CardLocation.SERVE_ZONE, Match.getOpponent(context.state, context.player)) > 0;
	},
	async activate(context) {
		let damageTargets = Match.findCards(context.state, () => true, CardLocation.SERVE_ZONE, Match.getOpponent(context.state, context.player));
		let damageAmount = 2;
		await Match.damage(context.state, damageTargets, damageAmount, EventReason.EFFECT, context.player);
		//Match.removeCardAttackCount(context.state, context.card);
	},
}

export default RIB_EYES_DRAGON_EFFECT;