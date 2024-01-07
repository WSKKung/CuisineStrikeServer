import 'jest-ts-auto-mock';
import { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	transform: {
		".(ts|tsx)": [
			"ts-jest", {
				"compiler": "ts-patch/compiler"
			}
		]
	}
}

export default jestConfig;