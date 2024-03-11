import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardBuff, CardBuffResetCondition } from "../../buff";

const MOLD_INVASION_EFFECT: CardEffect = {
	type: "trigger",
	resolutionPhase: "after",
	condition({ state, player, card, event }) {
		return !!event && event.type === "set" && event.card.owner === Match.getOpponent(state, player) && Match.countFilterCards(state, c => c.id !== card.id, CardLocation.HAND, player) > 0;
	},

	async activate({ state, player, card, event }) {
		if (!event || event.type !== "set") return;
		let discardOptions = Match.findCards(state, c => c.id !== card.id, CardLocation.HAND, player);
		let discardChoice = await Match.makePlayerSelectCards(state, { player: player, reason: EventReason.EFFECT | EventReason.COST }, player, discardOptions, 1, 1);
		await Match.discard(state, { player: player, reason: EventReason.EFFECT | EventReason.COST }, discardChoice);

		if (Card.getGrade(event.card) > 1) {
			let debuff: CardBuff = {
				id: Match.newUUID(state),
				type: "grade",
				operation: "add",
				amount: -1,
				sourceCard: card,
				resets: CardBuffResetCondition.TARGET_REMOVED
			};
			Match.addBuff(state, { player: player, reason: EventReason.EFFECT }, [event.card], debuff);
		}
		else {
			await Match.destroy(state, { player: player, reason: EventReason.EFFECT }, [event.card]);
		}
	},
}

export default MOLD_INVASION_EFFECT;