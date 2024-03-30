import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation, CardType } from "../../model/cards";
import { GameState, Match } from "../../match";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

function targetFilter(card: Card, state: GameState) {
	// target buff must not already has pierce
	return Card.hasType(card, CardType.DISH)
}

const POT_OF_GLUTTONY_EFFECT: CardEffect = {
	type: "activate",
	condition({state, card, player}) {
		return Match.countFilterCards(state, card => targetFilter(card, state), CardLocation.SERVE_ZONE, player) > 0;
	},

	async activate({state, card, player}) {
		Match.setSelectionHint(state, "Select a target card")
		let targetOptions = Match.findCards(state, card => targetFilter(card, state), CardLocation.TRASH, player);
		let targetChoice = await Match.makePlayerSelectCards(state, { player: player, reason: EventReason.EFFECT }, player, targetOptions, 1, 1);
		let buffAmount = Card.getGrade(targetChoice[0]) + 1;
		Match.addBuff(state, { player, reason: EventReason.EFFECT }, targetChoice, {
			id: Match.newUUID(state),
			type: "health",
			operation: "add",
			amount: buffAmount,
			sourceCard: card,
			resets: CardBuffResetCondition.TARGET_REMOVED
		})
	}
};

export default POT_OF_GLUTTONY_EFFECT;
