import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation, CardType } from "../../model/cards";
import { GameState, Match } from "../../match";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

function targetFilter(card: Card, state: GameState) {
	// target buff must not already has pierce
	return Card.hasType(card, CardType.DISH) && !Match.getBuffs(state, card).some(buff => buff.type === "pierce");
}

const PIERCING_STRIKE_EFFECT: CardEffect = {
	type: "activate",
	condition({state, card, player}) {
		return Match.countFilterCards(state, card => targetFilter(card, state), CardLocation.SERVE_ZONE, player) > 0;
	},

	async activate({state, card, player}) {
		Match.setSelectionHint(state, "Select a target card")
		let targetOptions = Match.findCards(state, card => targetFilter(card, state), CardLocation.TRASH, player);
		let targetChoice = await Match.makePlayerSelectCards(state, { player: player, reason: EventReason.EFFECT }, player, targetOptions, 1, 1);
		Match.addBuff(state, { player, reason: EventReason.EFFECT }, targetChoice, {
			id: Match.newUUID(state),
			type: "pierce",
			operation: "add",
			amount: 1,
			sourceCard: card,
			resets: CardBuffResetCondition.END_TURN | CardBuffResetCondition.TARGET_REMOVED
		})
	}
};

export default PIERCING_STRIKE_EFFECT;
