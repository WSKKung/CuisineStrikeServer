import { CardEffect } from "../../model/effect"
import DISH_COVER_EFFECT from "./dish_cover";
import FORK_TRAP_EFFECT from "./fork_trap";

const TRIGGER_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 11, effect: FORK_TRAP_EFFECT },
	{ code: 25, effect: DISH_COVER_EFFECT }
]

export default TRIGGER_CARD_EFFECTS;