import { describe, expect, it } from "vitest";
import {
  sanitizeStoredCustomers,
  sanitizeStoredTemplates,
} from "@/app/generator/bulk-invoicing";

describe("bulk-invoicing storage sanitizers", () => {
  it("keeps well-formed templates", () => {
    const templates = sanitizeStoredTemplates([
      {
        id: "t1",
        name: "Hosting",
        asset: "USDC",
        notes: "",
        taxRate: 7.5,
        lineItems: [{ id: "li1", description: "Retainer", quantity: 1, unitPrice: 120 }],
      },
    ]);

    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe("t1");
  });

  it("drops non-array and malformed template payloads", () => {
    expect(sanitizeStoredTemplates(null)).toEqual([]);
    expect(sanitizeStoredTemplates({ id: "t1" })).toEqual([]);
    expect(sanitizeStoredTemplates("junk")).toEqual([]);

    const templates = sanitizeStoredTemplates([
      { name: "missing-id" },
      { id: "", name: "empty-id" },
      { id: "ok", name: "fine", asset: "USDC", lineItems: [] },
    ]);
    expect(templates.map((t) => t.id)).toEqual(["ok"]);
  });

  it("keeps well-formed customers", () => {
    const customers = sanitizeStoredCustomers([
      {
        id: "c1",
        name: "Alice",
        email: "alice@example.com",
        address: "St. 1",
        username: "alice",
      },
    ]);

    expect(customers).toHaveLength(1);
    expect(customers[0].username).toBe("alice");
  });

  it("drops malformed customer entries but keeps valid ones", () => {
    const customers = sanitizeStoredCustomers([
      { name: "no-id" },
      { id: "c2" }, // missing name
      null,
      42,
      { id: "c3", name: "Carol", email: "", address: "", username: "" },
    ]);

    expect(customers.map((c) => c.id)).toEqual(["c3"]);
  });
});
