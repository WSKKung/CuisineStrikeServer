import { CardEffect } from "../../effects/effect";
import { EventReason } from "../../events";
import { Match } from "../../match";
import { Card, CardLocation, CardType } from "../../model/cards";

function recycleFilter(card: Card): boolean {
	return Card.hasType(card, CardType.DISH);
}

const OMELETTE_MAIDEN_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Card.hasLocation(context.card, CardLocation.SERVE_ZONE) && Match.countFilterCards(context.state, recycleFilter, CardLocation.TRASH, context.player) > 0
	},
	async activate(context) {
		Match.setSelectionHint(context.state, "HINT_SELECT_RECYCLE");
		let recycleOptions = Match.findCards(context.state, recycleFilter, CardLocation.TRASH, context.player);
		let recycleChoice = await Match.makePlayerSelectCards(context.state, context.player, recycleOptions, 1, 1);
		Match.sendToDeck(context.state, recycleChoice, context.player, "shuffle", EventReason.EFFECT, context.player);

		let gainedHP = Card.getPower(recycleChoice[0]);
		Match.restoreHP(context.state, context.player, gainedHP, EventReason.EFFECT, context.player);
	},
}

export default OMELETTE_MAIDEN_EFFECT;