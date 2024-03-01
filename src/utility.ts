import { boolean } from "zod";

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
	 * Shuffle contents of given array using Fisher–Yates shuffle algorithm
	 * This function mutates the given array.
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

	export function seperate<T>(array: Array<T>, filterFunction: (value: T) => boolean): ({ 0: Array<T>, 1: Array<T> }) {
		let result: { 0: Array<T>, 1: Array<T> } = { 0: [], 1: [] };
		for (let element of array) {
			if (filterFunction(element)) {
				result[1].push(element);
			} else {
				result[0].push(element);
			}
		}
		return result;
	}
	export function group<T, K extends string | number | symbol>(array: Array<T>, groupFunction: (value: T) => K): Record<K, Array<T>> {
		let result: Record<K , Array<T>> = {} as Record<K , Array<T>>;
		for (let element of array) {
			let groupKey = groupFunction(element);
			result[groupKey] = (result[groupKey] || []).concat(element);
		}
		return result;
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