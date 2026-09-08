import { TomlFetcherService } from "./toml-fetcher.service";

describe("TomlFetcherService bounded read", () => {
  let service: TomlFetcherService;

  beforeEach(() => {
    service = new TomlFetcherService();
  });

  function responseWithText(text: string): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
    return {
      body: stream,
      headers: new Headers(),
      text: () => Promise.resolve(text),
    } as unknown as Response;
  }

  it("returns text within the byte cap", async () => {
    const text = "NETWORK_INFORMATION = 'test'";
    const result = await (
      service as unknown as {
        readBoundedText(r: Response, max: number): Promise<string | null>;
      }
    ).readBoundedText(responseWithText(text), 1024 * 1024);

    expect(result).toBe(text);
  });

  it("returns null when the body exceeds the byte cap", async () => {
    const big = "x".repeat(2048);
    const result = await (
      service as unknown as {
        readBoundedText(r: Response, max: number): Promise<string | null>;
      }
    ).readBoundedText(responseWithText(big), 1024);

    expect(result).toBeNull();
  });
});