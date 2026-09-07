import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebhooksPage from "../page";

const ENDPOINT_URL_PLACEHOLDER = "https://api.yourdomain.com/webhook";
const SEEDED_ENDPOINT_URL = "https://api.example.com/webhooks/qiuckex";

function openCreateModal() {
  fireEvent.click(screen.getByRole("button", { name: "Create Webhook" }));
}

function submitEndpointForm() {
  const form = screen
    .getByPlaceholderText(ENDPOINT_URL_PLACEHOLDER)
    .closest("form");

  fireEvent.submit(form as HTMLFormElement);
}

describe("WebhooksPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an invalid endpoint URL inline instead of creating it", () => {
    render(<WebhooksPage />);
    openCreateModal();

    fireEvent.change(screen.getByPlaceholderText(ENDPOINT_URL_PLACEHOLDER), {
      target: { value: "not-a-real-url" },
    });
    submitEndpointForm();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid absolute URL",
    );
    // The modal stays open and no endpoint was added.
    expect(
      screen.getByRole("heading", { name: "Create Webhook Endpoint" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("creates an endpoint once the URL is valid", () => {
    render(<WebhooksPage />);
    openCreateModal();

    fireEvent.change(screen.getByPlaceholderText(ENDPOINT_URL_PLACEHOLDER), {
      target: { value: " https://hooks.acme.dev/payments " },
    });
    submitEndpointForm();

    expect(screen.getByText("https://hooks.acme.dev/payments")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Create Webhook Endpoint" }),
    ).not.toBeInTheDocument();
  });

  it("shows a successful test delivery in an in-page notice, not an alert", () => {
    const alertSpy = vi.fn();
    window.alert = alertSpy;
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    render(<WebhooksPage />);
    fireEvent.click(screen.getByText(SEEDED_ENDPOINT_URL));
    fireEvent.click(screen.getByRole("button", { name: "Test Webhook" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Test delivery succeeded (HTTP 200).",
    );
    expect(alertSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("surfaces a failed test delivery with the matching notice", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.4);

    render(<WebhooksPage />);
    fireEvent.click(screen.getByText(SEEDED_ENDPOINT_URL));
    fireEvent.click(screen.getByRole("button", { name: "Test Webhook" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Test delivery failed",
    );
    expect(screen.getByText(/Recent Test Delivery/)).toBeInTheDocument();
  });
});
