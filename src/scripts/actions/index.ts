import PEPPER_UP_EFFECT from "./pepper_up";
import { CardEffect } from "../../effects/effect";
import CHEF_BLESSING_EFFECT from "./chef_blessing";

const ACTION_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 8, effect: PEPPER_UP_EFFECT },
	{ code: 9, effect: CHEF_BLESSING_EFFECT }
]

export default ACTION_CARD_EFFECTS;