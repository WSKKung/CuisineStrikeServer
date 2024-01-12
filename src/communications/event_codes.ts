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
	ADD_CARD_TO_HAND = 3,
	CHANGE_TURN = 4,
	SET_INGREDIENT = 5,
	SUMMON_DISH = 6,
	DISCARD_CARD = 7,
	UPDATE_CARD = 8,
	UPDATE_PLAYER_HP = 9,
	END_GAME = 99
}
