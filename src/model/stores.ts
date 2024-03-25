import { z } from "zod"
import { ArrayUtil, Utility } from "../utility"
import { CollectionItem } from "./player_collections"

/**
 * An item in a shop that can be bought by player
 */
export type ShopItem = ShopItemCard | ShopItemPack

export interface ShopItemBase {
	type: string
	item_id: string
	price: number
	amount?: number
}

export interface ShopItemCard extends ShopItemBase {
	type: "card"
	code: number
}

export interface ShopItemPack extends ShopItemBase {
	type: "pack"
	pack_id: string
	pack_size: number
	cards: Array<{ code: number, amount: number }>
}

/**
 * Represent how to supply items
 */
export type ShopItemSupplier = ShopItemSupplierStatic | ShopItemSupplierRandom

export interface ShopItemSupplierBase {
	type: string
}

export interface ShopItemSupplierStatic extends ShopItemSupplierBase {
	type: "static"
	items: Array<ShopItem>
}

export interface ShopItemSupplierRandom extends ShopItemSupplierBase {
	type: "random"
	pools: Array<ShopItem>
	roll_count: number
}

/**
 * Represent how a shop manages its stocks
 */
export interface ShopSupplier {
	stocks: Array<ShopStockSupplier>
}

/**
 * Represent how the shop supplies each of its stock
 * a stock is a group of items that can be buy 
 */
export type ShopStockSupplier = ShopStockSupplierUnlimited | ShopStockSupplierLimited

export interface ShopStockSupplierBase {
	stock_id: string
	supplier: ShopItemSupplier
}

export interface ShopStockSupplierUnlimited extends ShopStockSupplierBase {
	type: "unlimited",
	available_since: number,
	restock_in_days?: number
}

export interface ShopStockSupplierLimited extends ShopStockSupplierBase {
	type: "limited"
	available_since: number
	expire_in_days: number
	restock_count?: number
}

/**
 * Represent the shop player interacts with
 */
export interface PlayerShop {
	stocks: Array<ShopStock>
}

/**
 * Represent a group of items that can be bought by player
 */
export interface ShopStock {
	stock_id: string,
	items: Array<ShopItem>,
	expires_in?: number,
	restock_count: number,
}

export const SHOP_SCHEMAS = {
	SHOP_SUPPLIER: z.custom<ShopSupplier>(),
	SHOP: z.custom<PlayerShop>()
}

export const DEFAULT_LIFETIME_SHOP_SUPPLIER: ShopSupplier = {
	stocks: [
		{
			stock_id: "basic_cards",
			type: "unlimited",
			available_since: new Date(2024, 2, 23).getTime(),
			supplier: {
				type: "static",
				items: [
					{
						item_id: "card_1",
						type: "card",
						code: 1,
						amount: 1,
						price: 200,
					},
					{
						item_id: "card_2",
						type: "card",
						code: 1,
						amount: 1,
						price: 200,
					},
					{
						item_id: "card_3",
						type: "card",
						code: 1,
						amount: 1,
						price: 200,
					}
				]
			}
		}
	]
}

export namespace PlayerShops {

	export function supplyNewItems(supplier: ShopItemSupplier): Array<ShopItem> {
		switch (supplier.type) {
			case "static":
				return [...supplier.items]
			
			case "random":
				let randomizedItems: Array<ShopItem> = [];
				for (let i=0; i<supplier.roll_count; i++) {
					let randomItem: ShopItem = ArrayUtil.pickRandom(supplier.pools, 1)[0];
					randomizedItems.push(randomItem);
				}
				return randomizedItems;
		}
	}

	export function getSupplierExpirationDate(supplier: ShopStockSupplier): number {
		const DAYS_TO_MILLISEC = 24 * 60 * 60 * 1000;
		if (supplier.type === "limited") {
			let expiredDate = supplier.available_since + supplier.expire_in_days * DAYS_TO_MILLISEC * ((supplier.restock_count || 0) + 1);
			return expiredDate
		}
		return -1;
	}
	
	export function isSupplierExpired(supplier: ShopStockSupplier, date: number): boolean {
		let expiredDate = getSupplierExpirationDate(supplier);
		return expiredDate > 0 ? date >= expiredDate : false;
	}


	export function supplyNewStock(supplier: ShopStockSupplier): ShopStock | null {
		let stock: ShopStock = {
			stock_id: supplier.stock_id,
			restock_count: 0,
			items: []
		};
		
		const DAYS_TO_MILLISEC = 24 * 60 * 60 * 1000

		// is limited time stock
		if (supplier.type === "limited") {
			// calculate the date which this stock is completed expired, meaning all of their restocks are run out
			// return null, for this stock is already completely expired
			if (isSupplierExpired(supplier ,Date.now())) {
				return null;
			}

			// convert from day to milliseconds
			let restock_duration: number = supplier.expire_in_days * DAYS_TO_MILLISEC
			stock.expires_in = supplier.available_since + restock_duration;

			// default restock count to 0 for one-time-only stock
			stock.restock_count = supplier.restock_count || 0;
		}
		else if (supplier.type === "unlimited" && supplier.restock_in_days) {
			let restock_duration: number = supplier.restock_in_days * DAYS_TO_MILLISEC
			stock.expires_in = supplier.available_since + restock_duration;
			stock.restock_count = -1;
		}

		stock.items = supplyNewItems(supplier.supplier);
		return stock;
	}

	export function supplyNewShop(supplier: ShopSupplier): PlayerShop {
		let shop: PlayerShop = { stocks: [] };
		for (let stockSupplier of supplier.stocks) {
			let stock = supplyNewStock(stockSupplier);
			if (stock)
				shop.stocks.push(stock);
		}
		return shop;
	}

	export function refreshShop(shop: PlayerShop, supplier: ShopSupplier): PlayerShop {
		let newShop: PlayerShop = { stocks: [] };

		for (let stockSupplier of supplier.stocks) {
			let existingStock = shop.stocks.find(s => s.stock_id === stockSupplier.stock_id);
			let newStock = !!existingStock ? refreshStock(existingStock, stockSupplier) : supplyNewStock(stockSupplier);
			if (newStock) {
				newShop.stocks.push(newStock);
			}
		}


		return newShop;
	}

	export function refreshStock(stock: ShopStock, supplier: ShopStockSupplier): ShopStock | null {
		const DAYS_TO_MILLISEC = 24 * 60 * 60 * 1000
		let newStock: ShopStock = {
			stock_id: stock.stock_id,
			expires_in: stock.expires_in,
			restock_count: stock.restock_count,
			items: []
		};

		let refreshTime: number = Date.now();
		
		// check this stock would be expired
		if (newStock.expires_in && newStock.expires_in <= refreshTime) {
			// check this stock can still be restocked
			if (supplier.type === "limited" && newStock.restock_count > 0) {
				let restock_duration: number = supplier.expire_in_days * DAYS_TO_MILLISEC;
				newStock.expires_in = newStock.expires_in + restock_duration;
				newStock.restock_count -= 1;
				newStock.items = supplyNewItems(supplier.supplier);
			}
			else if (supplier.type === "unlimited" && supplier.restock_in_days) {
				let restock_duration: number = supplier.restock_in_days * DAYS_TO_MILLISEC;
				newStock.expires_in = newStock.expires_in + restock_duration;
				newStock.items = supplyNewItems(supplier.supplier);
			}
			// this stock is expired
			else {
				return null;
			}
		}
		// if it is not expired, keep the original items
		else {
			newStock.items = stock.items;
		}

		return newStock;
	}

	export function findShopItem(shop: PlayerShop, stock_id: string, item_id: string): ShopItem | null {
		let targetStock = shop.stocks.find(stock => stock.stock_id === stock_id);
		if (!targetStock) {
			return null;
		}
		let targetItem = targetStock.items.find(item => item.item_id === item_id);
		if (!targetItem) {
			return null;
		}
		if (targetItem.amount && targetItem.amount > 0) {
			targetItem.amount -= 1;
		}

		return targetItem;
	}

	export function unpackShopItem(item: ShopItem): Array<CollectionItem> {
		switch (item.type) {
			case "card":
				return [ { id: "", code: item.code } ];
			
			case "pack":
				return ArrayUtil.pickRandom(item.cards, item.pack_size).map<CollectionItem>(c => ({ id: "", code: c.code }));
		}
	}
}
