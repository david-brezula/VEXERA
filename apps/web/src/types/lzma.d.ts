declare module "lzma" {
  const lzma: {
    compress(
      data: string | Uint8Array,
      mode: number,
      callback: (result: number[] | null, error?: Error) => void
    ): void
    decompress(
      data: number[] | Uint8Array,
      callback: (result: string | Uint8Array | null, error?: Error) => void
    ): void
  }
  export default lzma
}
