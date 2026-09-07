/**
 * Tests for installGlobalErrorHandler: it scrubs PII from logged error
 * messages, forwards to the previous handler, and can be uninstalled.
 */

import { installGlobalErrorHandler } from "../utils/global-error-handler";

const G_ADDRESS =
  "GAMOSFOKEYHFDGMXIEFEYBUYK3ZMFYN3PFLOTBRXFGBFGRKBKLQSLGLP";

type FakeErrorUtils = {
  getGlobalHandler: jest.Mock;
  setGlobalHandler: jest.Mock;
};

function installFakeErrorUtils(previous?: (error: unknown) => void) {
  const fake: FakeErrorUtils = {
    getGlobalHandler: jest.fn(() => previous ?? jest.fn()),
    setGlobalHandler: jest.fn(),
  };
  (globalThis as unknown as { ErrorUtils?: FakeErrorUtils }).ErrorUtils = fake;
  return fake;
}

function removeFakeErrorUtils() {
  delete (globalThis as unknown as { ErrorUtils?: unknown }).ErrorUtils;
}

describe("installGlobalErrorHandler", () => {
  afterEach(() => {
    removeFakeErrorUtils();
    jest.restoreAllMocks();
  });

  it("logs the error message with PII scrubbed", () => {
    installFakeErrorUtils();
    const logFn = jest.fn();
    installGlobalErrorHandler(logFn);

    const handler = (
      globalThis as unknown as { ErrorUtils: FakeErrorUtils }
    ).ErrorUtils.setGlobalHandler.mock.calls[0][0] as (
      error: unknown,
      isFatal?: boolean,
    ) => void;

    handler(new Error(`pay failed to ${G_ADDRESS}`), true);

    expect(logFn).toHaveBeenCalledWith(
      "[UnhandledError:FATAL]",
      "pay failed to [STELLAR_ADDR]",
    );
  });

  it("forwards the original error to the previously installed handler", () => {
    const previous = jest.fn();
    installFakeErrorUtils(previous);
    installGlobalErrorHandler();

    const handler = (
      globalThis as unknown as { ErrorUtils: FakeErrorUtils }
    ).ErrorUtils.setGlobalHandler.mock.calls[0][0] as (
      error: unknown,
      isFatal?: boolean,
    ) => void;

    const original = new Error("boom");
    handler(original, false);

    expect(previous).toHaveBeenCalledWith(original, false);
  });

  it("does nothing when ErrorUtils is unavailable", () => {
    removeFakeErrorUtils();
    const uninstall = installGlobalErrorHandler();
    expect(uninstall).toEqual(expect.any(Function));
    // No throw is the assertion here — call it for coverage.
    uninstall();
  });

  it("uninstall restores the previous handler", () => {
    const previous = jest.fn();
    const fake = installFakeErrorUtils(previous);
    const uninstall = installGlobalErrorHandler();

    // The fake's getGlobalHandler returns the installed handler after
    // setGlobalHandler — emulate that for the uninstall check.
    const installed = fake.setGlobalHandler.mock.calls[0][0];
    fake.getGlobalHandler.mockReturnValue(installed);

    uninstall();
    expect(fake.setGlobalHandler).toHaveBeenLastCalledWith(previous);
  });

  it("never throws when the scrubber path fails", () => {
    installFakeErrorUtils();
    const logFn = jest.fn(() => {
      throw new Error("log sink broken");
    });
    installGlobalErrorHandler(logFn);

    const handler = (
      globalThis as unknown as { ErrorUtils: FakeErrorUtils }
    ).ErrorUtils.setGlobalHandler.mock.calls[0][0] as (
      error: unknown,
      isFatal?: boolean,
    ) => void;

    expect(() => handler("some error", false)).not.toThrow();
  });
});