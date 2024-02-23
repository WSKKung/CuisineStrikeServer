import { CardEffect } from "../../model/effect";
import PEPPER_UP_EFFECT from "./pepper_up";
import CHEF_BLESSING_EFFECT from "./chef_blessing";
import RECIPE_RECALL_EFFECT from "./recipe_recall";
import APPETIZING_AURA_EFFECT from "./appetizing_aura";

const ACTION_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 8, effect: PEPPER_UP_EFFECT },
	{ code: 9, effect: CHEF_BLESSING_EFFECT },
	{ code: 10, effect: RECIPE_RECALL_EFFECT },
	{ code: 15, effect: APPETIZING_AURA_EFFECT }
]

export default ACTION_CARD_EFFECTS;