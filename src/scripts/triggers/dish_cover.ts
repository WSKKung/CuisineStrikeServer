import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card } from "../../model/cards";

const DISH_COVER_EFFECT: CardEffect = {
	type: "trigger",
	condition({ state, player, card, event }) {
		return !!event && event.type === "declare_attack" && event.attackingCard.owner === Match.getOpponent(state, player);
	},
	async activate({ state, player, card, event }) {
		if (!event || event.type !== "declare_attack") return;
		event.canceled = true;
	},
}

export default DISH_COVER_EFFECT;