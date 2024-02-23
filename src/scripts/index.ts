import { CardEffectProvider } from "../model/effect";
import ACTION_CARD_EFFECTS from "./actions"
import DISH_CARD_EFFECTS from "./dishes";
import INGREDIENT_CARD_EFFECTS from "./ingredients";
import TRIGGER_CARD_EFFECTS from "./triggers";

export function registerCardEffectScripts() {
	for (let entry of ACTION_CARD_EFFECTS) {
		CardEffectProvider.register(entry.code, entry.effect)
	}
	for (let entry of DISH_CARD_EFFECTS) {
		CardEffectProvider.register(entry.code, entry.effect)
	}
	for (let entry of INGREDIENT_CARD_EFFECTS) {
		CardEffectProvider.register(entry.code, entry.effect)
	}
	for (let entry of TRIGGER_CARD_EFFECTS) {
		CardEffectProvider.register(entry.code, entry.effect)
	}
}