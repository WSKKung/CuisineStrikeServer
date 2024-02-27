import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
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
		await Match.recycle(context.state, context.player, recycleChoice, "shuffle", EventReason.EFFECT);

		let gainedHP = Card.getPower(recycleChoice[0]);
		await Match.healPlayer(context.state, context.player, gainedHP, EventReason.EFFECT, context.player);
	},
}

export default OMELETTE_MAIDEN_EFFECT;