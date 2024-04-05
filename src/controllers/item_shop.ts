import { z } from "zod"
import { NakamaAdapter } from "../wrapper";
import { PlayerShops, SHOP_SCHEMAS, ShopSupplier } from "../model/stores";
import { guardSystemOnly } from "./guard";

const RPCSchemas = {
	updateShopSupplier: z.object({
		shop: SHOP_SCHEMAS.SHOP_SUPPLIER,
		update_mode: z.enum(["replace","add"]).default("add"),
		duplicate_mode: z.enum(["replace","ignore"]).default("ignore"),
	}),
	deleteShopSupplierStocks: z.object({
		stocks: z.array(z.string())
	}),
	getShop: z.any(),
	buyItem: z.object({
		stock_id: z.string(),
		item_id: z.string()
	})
}

export const deleteShopSupplierRpc: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	guardSystemOnly(ctx, logger, nk, payload);

	let payloadParseResult = RPCSchemas.deleteShopSupplierStocks.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let supplier = storage.readPlayerShopSupplier();
	supplier.stocks = supplier.stocks.filter(stock => args.stocks.every(id_to_delete => stock.stock_id !== id_to_delete));
	storage.updatePlayerShopSupplier(supplier);
	return JSON.stringify({ success: true, shop: supplier });
}

export const updateShopSupplierRpc: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	guardSystemOnly(ctx, logger, nk, payload);

	let payloadParseResult = RPCSchemas.updateShopSupplier.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let existingSupplier = storage.readPlayerShopSupplier();
	let newSupplier = args.shop;
	let updatedSupplier: ShopSupplier

	switch (args.update_mode) {
		case "replace":
			updatedSupplier = newSupplier;
			break;
		
		case "add":	
			switch (args.duplicate_mode) {
				case "replace":
					// filters out previous stock that is duplicate to one of the new stock
					existingSupplier.stocks = existingSupplier.stocks.filter(stock => {
						return newSupplier.stocks.every(newStock => newStock.stock_id !== stock.stock_id);
					});
					break;
				
				case "ignore":
					// filters out new stock that is duplicate to one of the previous stock
					newSupplier.stocks = newSupplier.stocks.filter(stock => {
						return existingSupplier.stocks.every(existingStock => existingStock.stock_id !== stock.stock_id);
					});
			}

			updatedSupplier = {
				stocks: existingSupplier.stocks.concat(newSupplier.stocks)
			}
			break;
	}

	storage.updatePlayerShopSupplier(updatedSupplier);
	return JSON.stringify({ success: true, shop: updatedSupplier });
}

export const getShopRpc: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let shop = storage.readPlayerShop(ctx.userId);
	return JSON.stringify({ success: true, shop: shop });
}

export const getShopSupplierRpc: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let shop = storage.readPlayerShopSupplier();
	return JSON.stringify({ success: true, shop: shop });
}

export const buyItemRpc: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
	let payloadParseResult = RPCSchemas.buyItem.safeParse(JSON.parse(payload));
	if (!payloadParseResult.success) {
		throw new Error("Invalid argument");
	}

	let args = payloadParseResult.data;
	let storage = NakamaAdapter.storageAccess({ nk, logger });
	let shop = storage.readPlayerShop(ctx.userId);
	let itemToBuy = PlayerShops.findShopItem(shop, args.stock_id, args.item_id);
	if (!itemToBuy) {
		throw new Error("Cannot find item to buy!");
	}

	if (itemToBuy.amount && itemToBuy.amount <= 0) {
		throw new Error("Item is already sold out!");
	}

	let playerCoin = storage.readPlayerCoin(ctx.userId);
	if (playerCoin < itemToBuy.price) {
		throw new Error("Not enough money!");
	}

	storage.takePlayerCoin(ctx.userId, itemToBuy.price);
	if (itemToBuy.amount) {
		itemToBuy.amount -= 1;
	}

	storage.updatePlayerShop(ctx.userId, shop);

	let boughtItems = PlayerShops.unpackShopItem(itemToBuy);
	storage.addCardToPlayerCollection(ctx.userId, boughtItems);

	return JSON.stringify({ success: true, items: [ itemToBuy ] });
	
}