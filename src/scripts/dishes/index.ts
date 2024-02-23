import { CardEffect } from "../../model/effect"
import BACON_AND_EGG_WARRIOR_EFFECT from "./bacon_and_egg_warrior";
import BEEF_CANNON_WELLINGTON_EFFECT from "./beef_cannon_wellington";
import BREAD_EFFECT from "./bread";
import HAMBURGER_EFFECT from "./hamburger";
import OMELETTE_MAIDEN_EFFECT from "./omelette_maiden";
import RIB_EYES_DRAGON_EFFECT from "./rib_eyes_dragon";
import SMOKED_BACON_BOAR_EFFECT from "./smoked_bacon_boar";

const DISH_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 4, effect: BREAD_EFFECT },
	{ code: 5, effect: HAMBURGER_EFFECT },
	{ code: 7, effect: BACON_AND_EGG_WARRIOR_EFFECT },
	{ code: 13, effect: SMOKED_BACON_BOAR_EFFECT },
	{ code: 14, effect: OMELETTE_MAIDEN_EFFECT },
	{ code: 23, effect: BEEF_CANNON_WELLINGTON_EFFECT },
	{ code: 24, effect: RIB_EYES_DRAGON_EFFECT }
]

export default DISH_CARD_EFFECTS;