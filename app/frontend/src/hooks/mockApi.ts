export async function mockFetch<T>(response: T, delay = 1200): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(response), delay);
  });
}

export async function mockContractCall(action: "extend" | "cleanup", id: string): Promise<boolean> {
  void action;
  void id;
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 800);
  });
}