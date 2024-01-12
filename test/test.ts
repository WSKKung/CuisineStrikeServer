import { describe, expect, test } from "@jest/globals";
import { Card, CardLocation, CardType } from "../src/card";
import { GameState, Match, getPlayerId } from "../src/match";
import { createMock } from "ts-auto-mock"
import { matchHandler } from "../src/match_handler";
import assert from "assert";

describe("Test Block", () => {
	test("Test Unit 1", () => {
		expect(1 + 1).toBe(2);
	})

	test("Test Card & State Management", () => {
		var mockState: GameState = Match.createState();
		var mockCardId: string = "c1"
		var mockPlayerId: string = "p1";
		var mockCard: Card = Card.create(mockCardId, 1, mockPlayerId, { code: 1, type: CardType.INGREDIENT, name: "Mock Card", description: "", classes: 0, grade: 1, power: 0, health: 0, bonusPower: 1, bonusHealth: 1 });
		
		Match.addPlayer(mockState, mockPlayerId);

		expect(Match.hasPlayer(mockState, mockPlayerId)).toBe(true);

		Match.addCard(mockState, mockCard);
		Match.moveCard(mockState, [ mockCard ], CardLocation.MAIN_DECK, mockPlayerId);

		let cards = Match.getCards(mockState, CardLocation.MAIN_DECK, mockPlayerId);
		expect(cards).toContain(mockCard);

		let foundCardById = Match.findCardByID(mockState, mockCardId);
		expect(foundCardById).not.toBeNull();

		if (foundCardById) {
			mockCard.location = CardLocation.HAND;
			//Match.drawCard(mockState, mockPlayerId, 1);
			expect(foundCardById.location).toBe(mockCard.location);
			
		}

		//expect(mockState.eventQueue.some(event => event.type === "update_card" && event.reason === "draw")).toBe(true);
		//Card.setHealth(mockCard, )
	})

	/*
	test("Test State Event", () => {
		let mockCtx = createMock<nkruntime.Context>();
		let mockLogger = createMock<nkruntime.Logger>();
		let mockNk = createMock<nkruntime.Nakama>();
		let mockDispatcher = createMock<nkruntime.MatchDispatcher>();
		let mockPresences = [
			createMock<nkruntime.Presence>({ userId: "1" }),
			createMock<nkruntime.Presence>({ userId: "2" })
		]
		let tick = 0;
		let matchMessages: nkruntime.MatchMessage[] = [

		];
		let matchState = {
			gameState: Match.createState(),
			presences: mockPresences
		}
		matchHandler.matchInit(mockCtx, mockLogger, mockNk, {});
		mockPresences.forEach(presence => Match.addPlayer(matchState.gameState, getPlayerId(presence)));
		matchHandler.matchLoop(mockCtx, mockLogger, mockNk, mockDispatcher, tick, matchState, matchMessages);
	})
	*/
})