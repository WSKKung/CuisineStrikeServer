import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

const HAMBURGER_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Match.countFilterCards(context.state, () => true, CardLocation.SERVE_ZONE, Match.getOpponent(context.state, context.player)) > 0;
	},
	async activate(context) {
		let damageOption = Match.findCards(context.state, () => true, CardLocation.SERVE_ZONE, Match.getOpponent(context.state, context.player));
		let damageChoice = await Match.makePlayerSelectCards(context.state, context.player, damageOption, 1, 1);
		let damageAmount = Math.floor(Card.getPower(context.card) / 2);
		await Match.damage(context.state, damageChoice, damageAmount, EventReason.EFFECT, context.player);
		Match.removeCardAttackCount(context.state, context.card);
	},
}

export default HAMBURGER_EFFECT;