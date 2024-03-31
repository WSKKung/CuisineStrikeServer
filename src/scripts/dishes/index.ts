import { CardEffect } from "../../model/effect"
import BACON_AND_EGG_WARRIOR_EFFECT from "./bacon_and_egg_warrior";
import BEEF_CANNON_WELLINGTON_EFFECT from "./beef_cannon_wellington";
import BREAD_EFFECT from "./bread";
import { EGG_SALADSAINT_EFFECT } from "./egg_saladsaint";
import { GREEN_SALADSAINT_EFFECT } from "./green_saladsaint";
import HAMBURGER_EFFECT from "./hamburger";
import { HIGH_CAESAR_SALADSAINT_EFFECT } from "./high_caesar_saladsaint";
import { KING_RATATOUILLE_EFFECT } from "./king_ratatouille";
import { MEOWZARELLA_EFFECT } from "./meowzzarella";
import OMELETTE_MAIDEN_EFFECT from "./omelette_maiden";
import { PARMESAN_RETRIEVER_EFFECT } from "./parmesan_retriever";
import { PIZZAESTRO_GRANDE_MARGHERITA_EFFECT } from "./pizzaestro_grande_margherita";
import { PIZZAESTRO_PEPPERONI_EFFECT } from "./pizzaestro_pepperoni";
import RIB_EYES_DRAGON_EFFECT from "./rib_eyes_dragon";
import SMOKED_BACON_BOAR_EFFECT from "./smoked_bacon_boar";
import { SUMMONING_CRUST_EFFECT } from "./summoning_crust";

const DISH_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 4, effect: BREAD_EFFECT },
	{ code: 5, effect: HAMBURGER_EFFECT },
	{ code: 7, effect: BACON_AND_EGG_WARRIOR_EFFECT },
	{ code: 13, effect: SMOKED_BACON_BOAR_EFFECT },
	{ code: 14, effect: OMELETTE_MAIDEN_EFFECT },
	{ code: 23, effect: BEEF_CANNON_WELLINGTON_EFFECT },
	{ code: 24, effect: RIB_EYES_DRAGON_EFFECT },
	{ code: 34, effect: GREEN_SALADSAINT_EFFECT },
	{ code: 35, effect: EGG_SALADSAINT_EFFECT },
	{ code: 36, effect: HIGH_CAESAR_SALADSAINT_EFFECT },
	{ code: 38, effect: KING_RATATOUILLE_EFFECT },
	{ code: 43, effect: MEOWZARELLA_EFFECT },
	{ code: 44, effect: PARMESAN_RETRIEVER_EFFECT },
	{ code: 45, effect: SUMMONING_CRUST_EFFECT },
	{ code: 46, effect: PIZZAESTRO_GRANDE_MARGHERITA_EFFECT },
	{ code: 47, effect: PIZZAESTRO_PEPPERONI_EFFECT }
]

export default DISH_CARD_EFFECTS;