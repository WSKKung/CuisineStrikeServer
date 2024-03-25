
type ComparerFunction<T> = (v1: T, v2: T) => number

export namespace Utility {

	/**
	 * Check if a bit mask `mask1` contains some of bit flags in another bit mask `mask2`
	 * @example 
	 * bitMaskIntersects(0b1110, 0b0010); // true
	 * bitMaskIntersects(0b1110, 0b1100); // true
	 * bitMaskIntersects(0b1110, 0b0001); // false
	 * bitMaskIntersects(0b1110, 0b0101); // true
	 * @param mask1 
	 * @param mask2 
	 * @returns 
	 */
	export function bitMaskIntersects(mask1: number, mask2: number): boolean {
		return (mask1 & mask2) !== 0;
	}

	/**
	 * Check if a bit mask `mask1` contains all of bit flags in another bit mask `mask2`
	 * @example 
	 * bitMaskIncludes(0b1110, 0b0010); // true
	 * bitMaskIncludes(0b1110, 0b1100); // true
	 * bitMaskIncludes(0b1110, 0b0001); // false
	 * bitMaskIncludes(0b1110, 0b0101); // false
	 * @param mask1 
	 * @param mask2 
	 * @returns 
	 */
	export function bitMaskIncludes(mask1: number, mask2: number): boolean {
		return (mask1 & mask2) === mask2;
	}
	
	/**
	 * Shuffle contents of given array using Fisher–Yates shuffle algorithm
	 * This function mutates the given array.
	 * @param array 
	 * @returns 
	 */
	export function shuffle<T>(array: Array<T>): Array<T> {
		let currentIndex: number = array.length;
		let randomIndex: number;
		  
		// While there remain elements to shuffle.
		while (currentIndex > 0) {
	  
		  // Pick a remaining element.
		  randomIndex = Math.floor(Math.random() * currentIndex);
		  currentIndex--;
	  
		  // And swap it with the current element.
		  [array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
		}
	  
		return array;
	}
	

	export function shallowClone(object: any): any {
		let cloned: any = {};
		Object.keys(object).forEach(key => cloned[key] = object[key]);
		return cloned;
	}

	export function randomIntRange(min: number, maxExclusive: number): number {
		return Math.floor(Math.random() * (maxExclusive - min) + min)
	}
}

export namespace SortUtil {

	/**
	 * Create a boolean comparator 
	 * @param getter 
	 * @param beforeValue 
	 * @param fallbackComparer 
	 * @returns 
	 */
	export function compareBoolean<T>(getter: (v: T) => boolean, beforeValue: boolean = false, fallback?: ComparerFunction<T> | undefined): ComparerFunction<T> {
		return (v1, v2) => {
			let comp1 = getter(v1);
			let comp2 = getter(v2);
			if (comp1 === comp2) {
                return fallback ? fallback(v1, v2) : 0;
            }
			if (comp1 === beforeValue) return -1;
			return 1;
		}
	}

	export function compareBooleanTF<T>(getter: (value: T) => boolean, fallback?: ComparerFunction<T> | undefined): ComparerFunction<T> {
		return compareBoolean(getter, true, fallback)
	}

	export function compareBooleanFT<T>(getter: (value: T) => boolean, fallback?: ComparerFunction<T> | undefined): ComparerFunction<T> {
		return compareBoolean(getter, false, fallback)
	}

}

export namespace ArrayUtil {
	/**
	 * Shuffle contents of given array using Fisher–Yates shuffle algorithm
	 * This function mutates the given array.
	 * @param array 
	 * @returns 
	 */
	export function shuffle<T>(array: Array<T>): Array<T> {
		let currentIndex: number = array.length;
		let randomIndex: number;
		  
		// While there remain elements to shuffle.
		while (currentIndex > 0) {
	  
		  // Pick a remaining element.
		  randomIndex = Math.floor(Math.random() * currentIndex);
		  currentIndex--;
	  
		  // And swap it with the current element.
		  [array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
		}
	  
		return array;
	}
	
	/**
	 * Picks random unique member from given array
	 * @param array 
	 * @returns 
	 */
	export function pickRandom<T>(array: Array<T>, count: number = 1): Array<T> {
		if (array.length < count) {
			throw new Error("Count cannot be larger than size of the array!")
		}

		let pickedIndices: Array<number> = [];
		while (pickedIndices.length < count) {
			let randomIndex = Math.floor(Math.random() * array.length)
			if (!pickedIndices.includes(randomIndex)) {
				pickedIndices.push(randomIndex);
			}
		}
		
		return pickedIndices.map(idx => array[idx]);
	}
		
	/**
	 * Picks a random unique member from given array using weighted randomness, given weight function from each member to pick
	 * @param array 
	 * @returns 
	 */
	export function pickRandomWeighted<T>(array: Array<T>, weightFunction: (entry: T) => number): T {
		let totalWeight: number = array.map(e => weightFunction(e)).reduce((a,b) => a+b, 0);
		let sortedArrayByWeight = [...array];
		sortedArrayByWeight.sort((a,b) => weightFunction(a) - weightFunction(b));

		let cumulativeRandomWeight = Math.random() * totalWeight;
		for (let member of sortedArrayByWeight) {
			let weight = weightFunction(member);
			if (cumulativeRandomWeight < weight) {
				return member;
			}
			cumulativeRandomWeight -= weight;
		}

		throw new Error("This is a bug, this should never be throwned!");
	}

	export function countUnique<T, K>(array: Array<T>, keyFunction: (value: T) => K): Array<{ key: K, count: number }> {
		let countArray: Array<{ key: K, count: number }> = [];
		for (let value of array) {
			let key: K = keyFunction(value)
			let counted: boolean = false;
			for (let countEntry of countArray) {
				if (countEntry.key === key) {
					countEntry.count += 1;
					counted = true;
					break;
				}
			}
			if (!counted) {
				countArray.push({ key: key, count: 0 });
			}
		}
		return countArray;
	}

	export function group<T, K>(array: Array<T>, groupFunction: (value: T) => K): Array<{ key: K, items: Array<T> }> {
		let result: Array<{ key: K, items: Array<T> }> = [];
		for (let element of array) {
			let groupKey: K = groupFunction(element);
			let groupEntry: { key: K, items: Array<T> } | undefined = result.find(entry => entry.key == groupKey);
			if (!groupEntry) {
				groupEntry = { key: groupKey , items: [] }
				result.push(groupEntry);
			}
			groupEntry.items.push(element);
		}
		return result;
	}

	export function range(min: number, maxExclusive: number, step: number = 1): Array<number> {
		let array: Array<number> = [];
		if (step >= 0) {
			for (let i = min; i < maxExclusive; i += step) {
				array.push(i);
			}
		} else {
			for (let i = min; i > maxExclusive; i += step) {
				array.push(i);
			}
		}
		return array;
	}
	
}

export namespace BitField {
	/**
	 * Check if at least one of the bit in `mask` matches with some bit in `value`
	 * @example 
	 * BitField.any(0b1110, 0b0010); // true
	 * BitField.any(0b1110, 0b1100); // true
	 * BitField.any(0b1110, 0b0001); // false
	 * BitField.any(0b1110, 0b0101); // true
	 * @param value 
	 * @param mask2 
	 * @returns 
	 */
	export function any(value: number, mask: number): boolean {
		return (value & mask) !== 0;
	}

	/**
	 * Check if every bits in `mask` match with some bit in `value`
	 * @example 
	 * BitField.all(0b1110, 0b0010); // true
	 * BitField.all(0b1110, 0b1100); // true
	 * BitField.all(0b1110, 0b0001); // false
	 * BitField.all(0b1110, 0b0101); // false
	 * @param value 
	 * @param mask2 
	 * @returns 
	 */
	export function all(value: number, mask: number): boolean {
		return (value & mask) === mask;
	}

	export function flaggedBits(value: number): Array<number> {
		let result: Array<number> = [];
		let currentBitValue: number = 1;
		while (value !== 0) {
			if ((value & 1) === 1) {
				result.push(currentBitValue);
			}
			value = value >>> 1;
			currentBitValue = currentBitValue << 1;
		}
		return result;
	}

}

export namespace UUIDUtil {

	export const NULL = '00000000-0000-0000-0000-000000000000'

	export function idToBase64(uuid: string): string {
		let uuidBytes = uuid.replace(/-/g, '');
		let uuidByteWords = uuidBytes.match(/.{1,2}/g)
		if (!uuidByteWords) return ""
		let uuidByteArray = uuidByteWords.map(function(byte) {
			return parseInt(byte, 16);
		});
		let base64Encoded = btoa(String.fromCharCode.apply(null, uuidByteArray));
		return base64Encoded;
	}

	export function base64ToId(encoded: string): string {
		let decodedByteArray = atob(encoded).split('').map(function(char) {
			return char.charCodeAt(0);
		});
		let uuidBytes = decodedByteArray.map(function(byte) {
			return ('0' + byte.toString(16)).slice(-2);
		}).join('');
		let uuidString = [
			uuidBytes.substring(0, 8),
			uuidBytes.substring(8, 12),
			uuidBytes.substring(12, 16),
			uuidBytes.substring(16, 20),
			uuidBytes.substring(20)
		].join('-');
		return uuidString;
	}
}