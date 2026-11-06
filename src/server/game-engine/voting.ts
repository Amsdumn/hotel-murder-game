import { isHotelRoom, isSelectableRoom, killPlayer, type EngineResult, type GameEngineState } from "./state";

export function canVoteForRoom(roomNumber: number, crimeRooms: number[], openedRooms: number[], murderedRooms: number[] = [], floorCount = 7): boolean {
  return isHotelRoom(roomNumber, floorCount) && !crimeRooms.includes(roomNumber) && !openedRooms.includes(roomNumber) && !murderedRooms.includes(roomNumber);
}

export function submitVote(state: GameEngineState, playerId: string, roomNumber: number): { state: GameEngineState; complete: boolean } {
  const player = state.players.find((item) => item.id === playerId);
  if (state.phase !== "VOTING" || !player || !player.isAlive) throw new Error("Voting is not permitted");
  if (!isSelectableRoom(state, roomNumber)) throw new Error("Room is not eligible");
  const currentVotes = state.votes ?? {};
  if (Object.hasOwn(currentVotes, playerId)) throw new Error("Player has already voted");
  const votes = { ...currentVotes, [playerId]: roomNumber };
  return {
    state: { ...state, votes },
    complete: state.players.filter((item) => item.isAlive).every((item) => Object.hasOwn(votes, item.id)),
  };
}

export function resolveVoteRoom(state: GameEngineState, roomNumber: number): EngineResult {
  if (state.phase !== "VOTING" && state.phase !== "RESOLUTION") throw new Error("Voting resolution is not permitted");
  if (!isSelectableRoom(state, roomNumber)) throw new Error("Room is not eligible");
  const occupant = state.players.find((player) => player.roomNumber === roomNumber);
  let next: GameEngineState = { ...state, openedRooms: [...state.openedRooms, roomNumber] };
  const privateEvents: EngineResult["privateEvents"] = [];
  if (occupant?.isAlive) {
    const death = killPlayer(next, occupant.id, "VOTE");
    next = death.state;
    if (death.privateEvent) privateEvents.push(death.privateEvent);
  }
  const publicEvents: EngineResult["publicEvents"] = [{ type: "ROOM_OPENED", roomNumber, occupancy: occupant ? "OCCUPIED" : "EMPTY", gameEnded: next.phase === "FINISHED" }];
  if (next.phase === "FINISHED" && next.winner) publicEvents.push({ type: "GAME_FINISHED", winner: next.winner });
  return { state: next, publicEvents, privateEvents };
}
