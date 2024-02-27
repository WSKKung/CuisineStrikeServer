import { CardEffect } from "../../model/effect"
import DISH_COVER_EFFECT from "./dish_cover";
import FORK_TRAP_EFFECT from "./fork_trap";
import MOLD_INVASION_EFFECT from "./mold_invasion";
import PLATE_RETURN_EFFECT from "./plate_return";
import RAT_ATTACK_EFFECT from "./rat_attack";

const TRIGGER_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 11, effect: FORK_TRAP_EFFECT },
	{ code: 25, effect: DISH_COVER_EFFECT },
	{ code: 26, effect: PLATE_RETURN_EFFECT },
	{ code: 27, effect: MOLD_INVASION_EFFECT },
	{ code: 28, effect: RAT_ATTACK_EFFECT }
]

export default TRIGGER_CARD_EFFECTS;