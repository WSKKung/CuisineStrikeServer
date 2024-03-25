import { z } from "zod"

export type CollectionItem = CardItem

export type CardCollection = {
	cards: Array<CardItem>
}

export interface CardItem {
	id: string,
	code: number
}

export const CollectionSchemas = {
	COLLECTION: z.custom<CardCollection>(),
	ITEM: z.custom<CardItem>()
}