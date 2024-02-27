export const GameConfiguration = {
	tickRate: 20,
	boardColumns: 3,
	drawSizePerTurns: 5,
	initialHP: 30,
	initialHandSize: 4,
	timeout: {
		fixed: 30, // does not replenish
		byTurn: 30 // replenish at beginning of player turn
	}
}

export const DeckConfiguration = {
	mainSize: {
		min: 40,
		max: 50
	},
	recipeSize: {
		min: 10,
		max: 15
	},
	maxDuplicates: 5
}

export const DecklistConfiguration = {
	maxDeckCount: 10
}