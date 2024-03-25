import { UUIDUtil } from "../utility";

const SYSTEM_USER_ID = UUIDUtil.NULL;
export const guardSystemOnly: nkruntime.RpcFunction = (ctx) => {
	if (ctx.userId && ctx.userId !== SYSTEM_USER_ID) {
		throw new Error("Unauthorized!");
	}
}