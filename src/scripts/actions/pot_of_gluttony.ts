import { CardBuff, CardBuffResetCondition } from "../../buff";
import { Card, CardLocation, CardType } from "../../model/cards";
import { Match } from "../../match";
import { CardEffect } from "../../model/effect";
import { EventReason } from "../../model/events";

const POT_OF_GLUTTONY_RECYCLE_COUNT = 5
const POT_OF_GLUTTONY_DRAW_COUNT = 5

function recycleFilter(card: Card) {
	return Card.hasType(card, CardType.INGREDIENT)
}

const POT_OF_GLUTTONY_EFFECT: CardEffect = {
	type: "activate",
	condition({state, card, player}) {
		return Match.countFilterCards(state, recycleFilter, CardLocation.TRASH, player) > POT_OF_GLUTTONY_RECYCLE_COUNT;
	},

	async activate({state, card, player}) {
		Match.setSelectionHint(state, "Select a card to recycle")
		let recycleOptions = Match.findCards(state, recycleFilter, CardLocation.TRASH, player);
		let recycleChoice = await Match.makePlayerSelectCards(state, { player: player, reason: EventReason.EFFECT | EventReason.COST }, player, recycleOptions, POT_OF_GLUTTONY_RECYCLE_COUNT, POT_OF_GLUTTONY_RECYCLE_COUNT);
		await Match.recycle(state, { player, reason: EventReason.EFFECT | EventReason.COST }, recycleChoice, "shuffle");

		await Match.drawCard(state, { player, reason: EventReason.EFFECT }, player, POT_OF_GLUTTONY_DRAW_COUNT);
	}
};

export default POT_OF_GLUTTONY_EFFECT;
