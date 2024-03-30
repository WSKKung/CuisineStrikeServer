import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../model/effect"
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardClass, CardLocation, CardType } from "../../model/cards";

const TOMATOAD_HEAL_AMOUNT = 3
const TOMATOAD_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Match.countCards(context.state, CardLocation.MAIN_DECK, context.player) >= 1;
	},
	async activate({ state, player, card }) {
		// cost
		Match.setSelectionHint(state, "Select a card to discard")
		let discardedCards = Match.getTopCards(state, 1, CardLocation.MAIN_DECK, player);
		await Match.discard(state, { player: player, reason: EventReason.EFFECT | EventReason.COST }, discardedCards);

		// set
		Match.healPlayer(state, { player, reason: EventReason.EFFECT }, player, TOMATOAD_HEAL_AMOUNT);
	},
}

export default TOMATOAD_EFFECT;