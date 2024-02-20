import { CardEffect } from "../../effects/effect"
import DREAMY_SHLEEP_EFFECT from "./dreamy_shleep";
import TUMBLEWHEAT_EFFECT from "./tumblewheats";
import UFYOLK_EFFECT from "./ufyolk";

const INGREDIENT_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 18, effect: TUMBLEWHEAT_EFFECT },
	{ code: 19, effect: DREAMY_SHLEEP_EFFECT },
	{ code: 20, effect: UFYOLK_EFFECT }
]

export default INGREDIENT_CARD_EFFECTS;