import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card } from "../../model/cards";

const FORK_TRAP_EFFECT: CardEffect = {
	type: "trigger",
	resolutionPhase: "after",
	condition({ state, player, card, event }) {
		return !!event && event.type === "declare_attack" && event.attackingCard.owner === Match.getOpponent(state, player);
	},
	async activate({ state, player, card, event }) {
		if (!event || event.type !== "declare_attack") return;
		Match.damage(state, [ event.attackingCard ], 5, EventReason.EFFECT, player);
		//event.negated = true;
	},
}

export default FORK_TRAP_EFFECT;