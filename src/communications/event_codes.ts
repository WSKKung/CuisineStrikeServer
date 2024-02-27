export enum PlayerActionCode {
	MESSAGE = 1,
	COMMIT_ACTION = 2,
	SURRENDER = 3,
	END_TURN = 4,
	SET_INGREDIENT = 5,
	SUMMON_DISH = 6,
	ATTACK = 7,
	CHECK_SET_INGREDIENT = 8,
	CHECK_SUMMON_DISH = 9,
	CHECK_ATTACK_TARGET = 10
}

export enum MatchEventCode {
	MESSAGE = 1,
	UPDATE_STATE = 2,
	UPDATE_CARD = 3,
	UPDATE_PLAYER_HP = 4,
	CHANGE_TURN = 5,
	CHANGE_PHASE = 6,
	SET_INGREDIENT = 7,
	SUMMON_DISH = 8,
	ATTACK = 9,
	ADD_CARD_TO_HAND = 10,
	DISCARD_CARD = 11,
	ACTIVATE = 12,
	REQUEST_CHOICE = 13,
	RESPOND_CHOICE = 14,
	DAMAGE_PLAYER = 15,
	HEAL_PLAYER = 16,
	UPDATE_AVAILABLE_ACTIONS = 17,
	DAMAGE_CARD = 18,
	DESTROY_CARD = 19,
	DRAW_CARD = 20,
	RECYCLE_CARD = 21,
	ERROR = 98,
	END_GAME = 99
}
