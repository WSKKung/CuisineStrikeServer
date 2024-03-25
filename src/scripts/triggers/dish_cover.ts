import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card } from "../../model/cards";

const DISH_COVER_EFFECT: CardEffect = {
	type: "trigger",
	resolutionPhase: "before",
	condition({ state, player, card, event }) {
		return !!event && event.type === "attack" && event.attackingCard.owner === Match.getOpponent(state, player);
	},
	async activate({ state, player, card, event }) {
		if (!event || event.type !== "attack") return;
		event.canceled = true;
		//Match.negateAttack(state, card);
	},
}

export default DISH_COVER_EFFECT;