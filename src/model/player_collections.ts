import { z } from "zod"

export type CardCollection = {
	cards: Array<CardItem>
}

export type CardItem = {
	id: string,
	code: number
}

export const CollectionSchemas = {
	COLLECTION: z.custom<CardCollection>(),
	ITEM: z.custom<CardItem>()
}