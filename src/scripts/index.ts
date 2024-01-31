import { CardEffectProvider } from "../effects/effect";
import ACTION_CARD_EFFECTS from "./actions"

export function registerCardEffectScripts() {
	for (let entry of ACTION_CARD_EFFECTS) {
		CardEffectProvider.register(entry.code, entry.effect)
	}
}