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
}