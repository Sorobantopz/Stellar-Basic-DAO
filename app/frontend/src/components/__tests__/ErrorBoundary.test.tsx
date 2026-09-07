import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";
import { RequestContextProvider } from "@/lib/requestContext";

// Silence the expected console.error that React emits for uncaught render
// errors in tests (the boundary still captures the error itself).
const originalConsoleError = console.error;

function ThrowingChild() {
  throw new Error("boom: render crashed");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows a recovery message instead of crashing the whole tree", () => {
    console.error = vi.fn();
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("An error occurred")).toBeInTheDocument();
    expect(screen.queryByText("All good")).not.toBeInTheDocument();
  });

  it("surfaces the captured error to the report-issue handler", () => {
    console.error = vi.fn();
    const onOpenReportIssue = vi.fn();

    render(
      <ErrorBoundary onOpenReportIssue={onOpenReportIssue}>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    screen.getByRole("button", { name: "Report Issue" }).click();
    expect(onOpenReportIssue).toHaveBeenCalledTimes(1);
    expect(onOpenReportIssue.mock.calls[0][0].message).toBe(
      "boom: render crashed",
    );
  });

  it("recovers when the error boundary itself sits under a provider", () => {
    console.error = vi.fn();
    render(
      <RequestContextProvider>
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      </RequestContextProvider>,
    );
    expect(screen.getByText("An error occurred")).toBeInTheDocument();
  });
});
