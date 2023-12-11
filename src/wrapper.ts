interface MatchMessageDispatcher {
	dispatch(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void,
	dispatchDeferred(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void
}

interface StorageAccess {
	read(): void,
	write(): void,
	delete(): void
}

function createNakamaMatchDispatcher(nakamaDispatcher: nkruntime.MatchDispatcher, state: GameState): MatchMessageDispatcher {
	return {

		dispatch(code, message, destinationPlayerIds, senderId, reliable) {
			let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => Match.getPresence(state, id))) || undefined;
			let senderPresences = (senderId && Match.getPresence(state, senderId)) || undefined;
			nakamaDispatcher.broadcastMessage(code, message, destinationPresences, senderPresences, reliable);
		},

		dispatchDeferred(code, message, destinationPlayerIds, senderId, reliable) {
			let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => Match.getPresence(state, id))) || undefined;
			let senderPresences = (senderId && Match.getPresence(state, senderId)) || undefined;
			nakamaDispatcher.broadcastMessageDeferred(code, message, destinationPresences, senderPresences, reliable);
		},

	};
}

// function createNakamaStorageAccess(nk: nkruntime.Nakama): StorageAccess {
// 	nk.storageWrite
// 	nk.storageRead
// 	nk.storageDelete
// 	return {

// 	};
// }