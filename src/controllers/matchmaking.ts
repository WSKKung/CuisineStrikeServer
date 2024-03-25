export const createPrivateRoomRpc: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	const matchId = nk.matchCreate("lobby", {});
	return JSON.stringify({ match_id: matchId });
}

export const getPreviousOngoingMatchRpc: nkruntime.RpcFunction = function(ctx, logger, nk, payload) {
	let account = nk.accountGetId(ctx.userId);
	let matchId = account.user.metadata.ongoing_match_id;
	if (matchId) {
		let match = nk.matchGet(matchId);
		if (match) {
			return JSON.stringify({ success: true, match_id: matchId });
		}
	}
	return JSON.stringify({ success: true, match_id: null });
}