interface MatchMessageDispatcher {
	dispatch(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void,
	dispatchDeferred(code: number, message: string, destinationPlayerIds?: Array<string> | null, senderId?: string | null, reliable?: boolean): void
}

interface IDGenerator {
	uuid(): string
}

interface StorageAccess {
	read(): void,
	write(): void,
	delete(): void
}

function createNakamaMatchDispatcher(nakamaDispatcher: nkruntime.MatchDispatcher, presences: PlayerPresences): MatchMessageDispatcher {
	return {

		dispatch(code, message, destinationPlayerIds, senderId, reliable) {
			let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => presences[id]!)) || undefined;
			let senderPresences = (senderId && presences[senderId]) || undefined;
			nakamaDispatcher.broadcastMessage(code, message, destinationPresences, senderPresences, reliable);
		},

		dispatchDeferred(code, message, destinationPlayerIds, senderId, reliable) {
			let destinationPresences = (destinationPlayerIds && destinationPlayerIds.map(id => presences[id]!)) || undefined;
			let senderPresences = (senderId && presences[senderId]) || undefined;
			nakamaDispatcher.broadcastMessageDeferred(code, message, destinationPresences, senderPresences, reliable);
		},

	};
}

function createNakamaIDGenerator(nakamaAPI: nkruntime.Nakama): IDGenerator {
	return {
		uuid() {
			return nakamaAPI.uuidv4();
		}
	}
}

// function createNakamaStorageAccess(nk: nkruntime.Nakama): StorageAccess {
// 	nk.storageWrite
// 	nk.storageRead
// 	nk.storageDelete
// 	return {

// 	};
// }