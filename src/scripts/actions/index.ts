import { CardEffect } from "../../model/effect";
import PEPPER_UP_EFFECT from "./pepper_up";
import CHEF_BLESSING_EFFECT from "./chef_blessing";
import RECIPE_RECALL_EFFECT from "./recipe_recall";
import APPETIZING_AURA_EFFECT from "./appetizing_aura";
import POT_OF_GLUTTONY_EFFECT from "./pot_of_gluttony";
import THERMOHEAL_REHEAT_EFFECT from "./thermoheal_reheat";
import PIERCING_STRIKE_EFFECT from "./piercing_strike";

const ACTION_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 8, effect: PEPPER_UP_EFFECT },
	{ code: 9, effect: CHEF_BLESSING_EFFECT },
	{ code: 10, effect: RECIPE_RECALL_EFFECT },
	{ code: 15, effect: APPETIZING_AURA_EFFECT },
	{ code: 39, effect: THERMOHEAL_REHEAT_EFFECT },
	{ code: 48, effect: POT_OF_GLUTTONY_EFFECT },
	{ code: 49, effect: PIERCING_STRIKE_EFFECT }
]

export default ACTION_CARD_EFFECTS;