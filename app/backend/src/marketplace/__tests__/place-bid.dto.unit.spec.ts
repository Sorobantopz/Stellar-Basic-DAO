import { validate } from "class-validator";
import { PlaceBidDto } from "../dto/place-bid.dto";

// Valid 56-char Stellar public key (G + 55 base32 chars), per the validator's own unit tests.
const PK = "GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWRABCDEFGHIJKL";

describe("PlaceBidDto amount validation", () => {
  it("rejects an infinite bid amount", async () => {
    const dto = new PlaceBidDto();
    dto.bidderPublicKey = PK;
    dto.bidAmount = Infinity;
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain("bidAmount");
  });

  it("rejects NaN bid amounts", async () => {
    const dto = new PlaceBidDto();
    dto.bidderPublicKey = PK;
    dto.bidAmount = NaN;
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain("bidAmount");
  });

  it("accepts a finite positive bid amount", async () => {
    const dto = new PlaceBidDto();
    dto.bidderPublicKey = PK;
    dto.bidAmount = 12.5;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});