import { BadRequestException } from "@nestjs/common";
import { StudyRoomController } from "./study-room.controller";

const VALID_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCOWN";

describe("StudyRoomController public-key validation", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let controller: StudyRoomController;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: any;

  beforeEach(() => {
    service = {
      listRooms: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      createRoom: jest.fn().mockResolvedValue({ id: "r1" }),
      updateRoom: jest.fn().mockResolvedValue({ id: "r1" }),
      deleteRoom: jest.fn().mockResolvedValue(undefined),
      getRoomById: jest.fn().mockResolvedValue({ id: "r1" }),
      joinRoom: jest.fn().mockResolvedValue({ id: "m1" }),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      listMembers: jest.fn().mockResolvedValue([]),
      sendMessage: jest.fn().mockResolvedValue({ id: "msg1" }),
      listMessages: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 }),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
    };
    controller = new StudyRoomController(service);
  });

  it("accepts a well-formed Stellar public key for room creation", async () => {
    await controller.createRoom(
      { topic: "rust", name: "Rust Study", description: "", tags: [], maxParticipants: null },
      VALID_KEY,
    );
    expect(service.createRoom).toHaveBeenCalledWith(
      expect.anything(),
      VALID_KEY,
    );
  });

  it("rejects a malformed public key for room creation", async () => {
    await expect(
      controller.createRoom(
        { topic: "rust", name: "Rust Study", description: "", tags: [], maxParticipants: null },
        "not-a-key",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(service.createRoom).not.toHaveBeenCalled();
  });

  it("rejects a wrong-length public key for room join", async () => {
    await expect(
      controller.joinRoom("00000000-0000-0000-0000-000000000000", "GABC"),
    ).rejects.toThrow(BadRequestException);
    expect(service.joinRoom).not.toHaveBeenCalled();
  });

  it("rejects a missing public key for message send", async () => {
    await expect(
      controller.sendMessage(
        "00000000-0000-0000-0000-000000000000",
        { content: "hi" },
        "",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(service.sendMessage).not.toHaveBeenCalled();
  });

  it("clamps oversized room-list page sizes", async () => {
    await controller.listRooms(undefined, undefined, 1, 9999);
    expect(service.listRooms).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it("clamps oversized message-list page sizes", async () => {
    await controller.listMessages(
      "00000000-0000-0000-0000-000000000000",
      1,
      9999,
    );
    expect(service.listMessages).toHaveBeenCalledWith(
      expect.anything(),
      1,
      200,
    );
  });
});