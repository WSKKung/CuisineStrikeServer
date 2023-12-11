const PLAYER_INITIAL_HP = 30

const MATCH_TICK_RATE = 10;
const MATCH_BOARD_COLUMNS = 3;

enum PlayerActionCode {
	MESSAGE = 1,
	END_TURN = 2,
	PLAY_INGREDIENT = 3,
	SUMMON_DISH = 4,
	ATTACK = 5,
	PLAY_ACTION = 6,
	PLAY_TRIGGER = 7,
	ACTIVATE_ABILITY = 8,
	END_GAME = 99
}

enum MatchEventCode {
	MESSAGE = 1,
	END_TURN = 2,
	END_GAME = 99
}

const MATCH_OPCODE_MSG = 1
const MATCH_OPCODE_END_TURN = 2
const MATCH_OPCODE_PLAY_INGREDIENT = 3
const MATCH_OPCODE_GAME_END = 99