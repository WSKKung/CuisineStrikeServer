import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

export const GREEN_SALADSAINT_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		return true;
	},
	async activate({ state, player, card}) {
		let opponent = Match.getOpponent(state, player);
		let gainedHP = Card.getGrade(card);
		await Promise.all([
			Match.healPlayer(state, { player, reason: EventReason.EFFECT }, player, gainedHP),
			Match.healPlayer(state, { player, reason: EventReason.EFFECT }, opponent, gainedHP)
		]);

		if (Match.getHP(state , player) > Match.getHP(state, opponent)) {
			let debuffTargets = Match.findCards(state, c => true, CardLocation.SERVE_ZONE, opponent);
			Match.addBuff(state, { player, reason: EventReason.EFFECT }, debuffTargets, {
				id: Match.newUUID(state),
				type: "power",
				operation: "add",
				amount: -gainedHP,
				sourceCard: card,
				resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
			});
		}
	},
}