import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card } from "../../model/cards";

const FORK_TRAP_EFFECT: CardEffect = {
	type: "trigger",
	resolutionPhase: "before",
	condition({ state, player, card, event }) {
		return !!event && event.type === "attack" && event.attackingCard.owner === Match.getOpponent(state, player);
	},
	async activate({ state, player, card, event }) {
		if (!event || event.type !== "attack") return;
		Match.damage(state, { player: player, reason: EventReason.EFFECT }, [ event.attackingCard ], 5);
		//event.negated = true;
	},
}

export default FORK_TRAP_EFFECT;