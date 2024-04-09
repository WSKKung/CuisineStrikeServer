import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardBuffResetCondition } from "../../buff";

const OVERHEAT_EFFECT: CardEffect = {
	type: "trigger",
	resolutionPhase: "after",

	condition({ state, player, card, event }) {
		return !!event && event.type === "summon" && Card.getOwner(event.card) !== player;
	},

	async activate({ state, player, card, event }) {
		if (!event || event.type !== "summon") return;
		let debuffAmount = -Card.getGrade(event.card);
		Match.addBuff(state, { player, reason: EventReason.EFFECT }, [event.card], {
			id: Match.newUUID(state),
			type: "power",
			operation: "add",
			amount: debuffAmount,
			sourceCard: card,
			resets: CardBuffResetCondition.TARGET_REMOVED
		});
		//event.negated = true;
	},
}

export default OVERHEAT_EFFECT;