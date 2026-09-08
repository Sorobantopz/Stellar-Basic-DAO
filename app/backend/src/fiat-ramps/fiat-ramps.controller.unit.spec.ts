import { validate } from 'class-validator';
import { InitiateFiatRampDto } from './dto/fiat-ramps.dto';

describe('InitiateFiatRampDto', () => {
  const valid = {
    assetCode: 'USDC',
    amount: 100.5,
    userAccount: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    anchorDomain: 'anchor.stellar.org',
  };

  async function errorsFor(patch: Partial<InitiateFiatRampDto>) {
    const dto = new InitiateFiatRampDto();
    Object.assign(dto, { ...valid, ...patch });
    return validate(dto);
  }

  it('accepts a well-formed request', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('rejects an anchor domain with a scheme', async () => {
    const errors = await errorsFor({ anchorDomain: 'https://anchor.stellar.org' });
    expect(errors.some((e) => e.property === 'anchorDomain')).toBe(true);
  });

  it('rejects an anchor domain with a path or query', async () => {
    const pathErr = await errorsFor({ anchorDomain: 'anchor.stellar.org/evil' });
    expect(pathErr.some((e) => e.property === 'anchorDomain')).toBe(true);

    const queryErr = await errorsFor({ anchorDomain: 'anchor.stellar.org?x=1' });
    expect(queryErr.some((e) => e.property === 'anchorDomain')).toBe(true);
  });

  it('rejects an IP address as anchor domain', async () => {
    const errors = await errorsFor({ anchorDomain: '192.168.1.1' });
    expect(errors.some((e) => e.property === 'anchorDomain')).toBe(true);
  });

  it('rejects a malformed Stellar public key', async () => {
    const errors = await errorsFor({ userAccount: 'not-a-key' });
    expect(errors.some((e) => e.property === 'userAccount')).toBe(true);
  });

  it('rejects a non-positive amount', async () => {
    expect((await errorsFor({ amount: 0 })).some((e) => e.property === 'amount')).toBe(true);
    expect((await errorsFor({ amount: -5 })).some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects an asset code with invalid characters', async () => {
    const errors = await errorsFor({ assetCode: 'usdc;DROP' });
    expect(errors.some((e) => e.property === 'assetCode')).toBe(true);
  });
});