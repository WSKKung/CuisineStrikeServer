import { CardBuffResetCondition } from "../../buff";
import { Match } from "../../match";
import { Card, CardLocation } from "../../model/cards";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

const HEALTH_BUFF_AMOUNT = 1

export const HIGH_CAESAR_SALADSAINT_EFFECT: CardEffect = {
	type: "activate",
	condition({ state, player, card}) {
		return Match.countFilterCards(state, c => true, CardLocation.SERVE_ZONE, player) > 0;
	},
	async activate({ state, player, card}) {
		let opponent = Match.getOpponent(state, player);

		let buffTargets = Match.findCards(state, c => true, CardLocation.SERVE_ZONE, player);
		Match.addBuff(state, { player, reason: EventReason.EFFECT }, buffTargets, {
			id: Match.newUUID(state),
			type: "health",
			operation: "add",
			amount: HEALTH_BUFF_AMOUNT,
			sourceCard: card,
			resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
		});

		let player_hp = Match.getHP(state, player)
		let opponent_hp = Match.getHP(state, opponent)
		if (player_hp > opponent_hp) {
			// gain hp equal to half the difference, up to the card's power
			let gainedPower = Math.min(Math.floor((player_hp - opponent_hp) / 2.0), Card.getPower(card));
			Match.addBuff(state, { player, reason: EventReason.EFFECT }, buffTargets, {
				id: Match.newUUID(state),
				type: "power",
				operation: "add",
				amount: gainedPower,
				sourceCard: card,
				resets: CardBuffResetCondition.TARGET_REMOVED | CardBuffResetCondition.END_TURN
			});
		}
	},
}