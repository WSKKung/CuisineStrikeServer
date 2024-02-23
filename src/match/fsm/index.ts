import { GameState } from "../../match";

export class FSM<Data = any> {
	states: {[name: string]: FSMState<Data>}
	currentStateName: string
	data: Data

	constructor(data: Data) {
		this.states = {}
		this.currentStateName = ""
		this.data = data;
	}

	register(state: FSMState<Data>): void {
		this.states[state.name] = state;
	}

	update(data: Data): void {
		this.data = data;
		this.states[this.currentStateName].update();
	}

	transition(nextStateName: string): void {
		let prevState = this.states[this.currentStateName];
		if (prevState) {
			prevState.exit();
		}
		let nextState = this.states[nextStateName];
		if (nextState) {
			nextState.enter();
		}
		this.currentStateName = nextStateName;
	}
}

export interface FSMState<Data> {
	fsm: FSM<Data>
	name: string
	enter(): void
	exit(): void
	update(): void
}

export function createMatchFSM(state: GameState): FSM<{state: GameState}> {
	let fsm = new FSM<{state: GameState}>({ state: state });

	fsm.register({
		fsm: fsm,
		name: "foo",
		enter() {
			fsm.data.state.log?.debug("enter foo");
		},
		exit() {
			fsm.data.state.log?.debug("exit foo");
		},
		update() {
		}
	});

	fsm.register({
		fsm: fsm,
		name: "bar",
		enter() {
			fsm.data.state.log?.debug("enter bar");
		},
		exit() {
			fsm.data.state.log?.debug("exit bar");
		},
		update() {
		}
	});


	return fsm;
}