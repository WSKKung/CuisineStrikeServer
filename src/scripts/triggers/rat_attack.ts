import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";

const RAT_ATTACK_DAMAGE = 4;

const RAT_ATTACK_EFFECT: CardEffect = {
	type: "trigger",
	resolutionPhase: "after",
	condition({ state, player, card, event }) {
		return !!event && event.type === "summon" && event.card.owner === Match.getOpponent(state, player) && Match.countFilterCards(state, c => c.id !== card.id, CardLocation.HAND, player) > 0;
	},
	async activate({ state, player, card, event }) {
		if (!event || event.type !== "summon") return;
		let discardOptions = Match.findCards(state, c => c.id !== card.id, CardLocation.HAND, player);
		let discardChoice = await Match.makePlayerSelectCards(state, player, discardOptions, 1, 1);
		await Match.discard(state, { player: player, reason: EventReason.EFFECT | EventReason.COST }, discardChoice);

		await Match.damage(state, { player: player, reason: EventReason.EFFECT }, [event.card], RAT_ATTACK_DAMAGE);
		//event.negated = true;
	},
}

export default RAT_ATTACK_EFFECT;