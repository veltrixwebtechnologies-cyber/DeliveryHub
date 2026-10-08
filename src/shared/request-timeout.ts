export async function withRequestTimeout<T>(
  request: PromiseLike<T>,
  milliseconds = 15_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error("Supabase did not respond in time. Check your connection and retry.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
