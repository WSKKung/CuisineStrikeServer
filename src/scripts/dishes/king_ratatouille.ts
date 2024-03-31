import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

export const KING_RATATOUILLE_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		// discard cost requirement
		if (Match.countFilterCards(state, () => true, CardLocation.HAND, player) <= 0) return false;
		return true;
	},
	async activate({ state, player, card}) {
		let validTargets = Match.findCards(state, () => true, CardLocation.HAND, player);
		let selectedTargets = await Match.makePlayerSelectCards(state, { player, reason: EventReason.EFFECT | EventReason.COST }, player, validTargets, 1, 1);
		await Match.discard(state, { player, reason: EventReason.EFFECT | EventReason.COST }, selectedTargets);
		
		let gainedHP = Card.getGrade(card) + 1;
		await Match.healPlayer(state, { player, reason: EventReason.EFFECT }, player, gainedHP);
	},
}