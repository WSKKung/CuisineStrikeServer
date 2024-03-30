import { CardEffect } from "../../model/effect"
import DREAMY_SHLEEP_EFFECT from "./dreamy_shleep";
import SPIRIT_OF_SOYA_LAKE_EFFECT from "./spirt_of_the_soya_lake";
import TOMATOAD_EFFECT from "./tomatoad";
import TUMBLEWHEAT_EFFECT from "./tumblewheats";
import UFYOLK_EFFECT from "./ufyolk";
import WILD_CABMAGE_EFFECT from "./wild_cabmage";

const INGREDIENT_CARD_EFFECTS: Array<{code: number, effect: CardEffect}> = [
	{ code: 18, effect: TUMBLEWHEAT_EFFECT },
	{ code: 19, effect: DREAMY_SHLEEP_EFFECT },
	{ code: 20, effect: UFYOLK_EFFECT },
	{ code: 33, effect: WILD_CABMAGE_EFFECT },
	{ code: 37, effect: TOMATOAD_EFFECT },
	{ code: 42, effect: SPIRIT_OF_SOYA_LAKE_EFFECT },
]

export default INGREDIENT_CARD_EFFECTS;