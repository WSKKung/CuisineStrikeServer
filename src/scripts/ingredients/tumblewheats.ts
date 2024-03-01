import { CardBuff, CardBuffResetCondition } from "../../buff";
import { CardEffect } from "../../model/effect"
import { EventReason } from "../../model/events";
import { Match } from "../../match";
import { Card, CardClass, CardLocation, CardType } from "../../model/cards";

function targetFilter(card: Card, ownerCard: Card) {
	return !Card.isSame(card, ownerCard) && Card.hasType(card, CardType.INGREDIENT) && Card.hasClass(card, CardClass.GRAIN);
}

const TUMBLEWHEAT_EFFECT: CardEffect = {
	type: "activate",
	condition(context) {
		return Match.countCards(context.state, CardLocation.HAND, context.player) >= 1 && Match.countFilterCards(context.state, c => targetFilter(c, context.card), CardLocation.TRASH, context.player) > 0;
	},
	async activate(context) {
		// cost
		Match.setSelectionHint(context.state, "Select a card to discard")
		let discardOptions = Match.getCards(context.state, CardLocation.HAND, context.player);
		let discardChoice = await Match.makePlayerSelectCards(context.state, context.player, discardOptions, 1, 1);
		await Match.discard(context.state, discardChoice.concat(context.card), context.player, EventReason.EFFECT | EventReason.COST);

		// set
		Match.setSelectionHint(context.state, "Select a card to Set to the field")
		let setOptions = Match.findCards(context.state, c => targetFilter(c, context.card), CardLocation.TRASH, context.player);
		let setChoice = await Match.makePlayerSelectCards(context.state, context.player, setOptions, 1, 1);
		let setZoneChoice = await Match.makePlayerSelectFreeZone(context.state, context.player, CardLocation.STANDBY_ZONE, context.player);
		if (setZoneChoice) {
			await Match.setToStandby(context.state, setChoice[0], context.player, setZoneChoice.column);
		}
		
		let gradeBuff: CardBuff = {
			id: Match.newUUID(context.state),
			type: "grade",
			sourceCard: context.card,
			operation: "add",
			amount: 1,
			resets: CardBuffResetCondition.TARGET_REMOVED
		};
		Match.addBuff(context.state, setChoice, gradeBuff);

	},
}

export default TUMBLEWHEAT_EFFECT;