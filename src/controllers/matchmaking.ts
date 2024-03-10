export const createPrivateRoomRpc: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	const matchId = nk.matchCreate("lobby", {});
	return JSON.stringify({ match_id: matchId });
}
