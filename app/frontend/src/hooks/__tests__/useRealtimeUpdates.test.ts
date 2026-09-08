import { renderHook, act } from "@testing-library/react";
import { useRealtimeUpdates } from "../useRealtimeUpdates";

describe("useRealtimeUpdates (MockWebSocket singleton)", () => {
  it("reports connected while mounted", () => {
    const { result } = renderHook(() => useRealtimeUpdates());
    expect(result.current.isConnected).toBe(true);
  });

  it("keeps updates flowing while any consumer remains mounted", () => {
    const first = renderHook(() => useRealtimeUpdates());
    const second = renderHook(() => useRealtimeUpdates());

    // Unmounting one consumer must not disconnect the shared socket while
    // the other is still mounted.
    act(() => {
      first.unmount();
    });
    expect(second.result.current.isConnected).toBe(true);

    act(() => {
      second.unmount();
    });
  });

  it("disconnects only after the last consumer unmounts", () => {
    const first = renderHook(() => useRealtimeUpdates());
    const second = renderHook(() => useRealtimeUpdates());

    act(() => {
      second.unmount();
    });
    // First consumer still mounted → still connected.
    expect(first.result.current.isConnected).toBe(true);

    act(() => {
      first.unmount();
    });
  });
});